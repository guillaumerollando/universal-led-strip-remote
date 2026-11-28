package expo.modules.ledstripnative

import android.content.Context
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.URL

/**
 * Configurer une lumière Wi-Fi neuve : voir les réseaux autour (celui de la lumière, ceux de la maison), se connecter
 * au réseau de la lumière le temps de lui donner le Wi-Fi de la maison, puis rendre la main.
 *
 * Android 10+ : la connexion passe par `WifiNetworkSpecifier` (Android demande « Se connecter à … ? ») et ne touche
 * pas au Wi-Fi du téléphone ; les requêtes vers la lumière passent par ce réseau-là, sans internet.
 */
internal class WifiSetup(private val context: Context) {
  private val wifi get() = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
  private val connectivity get() = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

  private var apNetwork: Network? = null
  private var apCallback: ConnectivityManager.NetworkCallback? = null

  /**
   * Réseaux autour : nouveau scan (limité par Android à 4 toutes les 2 min), sinon les derniers résultats. Android garde
   * un réseau dans sa liste un moment après sa disparition : on ne garde que ceux vus depuis moins de 30 s (sinon une
   * lumière tout juste configurée apparaîtrait encore « en attente »).
   */
  @Suppress("DEPRECATION")
  fun scan(): List<Map<String, Any>> {
    if (wifi.startScan()) Thread.sleep(3500)
    val nowUs = android.os.SystemClock.elapsedRealtime() * 1000
    return wifi.scanResults.filter { it.SSID.isNotBlank() && nowUs - it.timestamp < 30_000_000 }.map {
      mapOf(
        "ssid" to it.SSID,
        "frequency" to it.frequency,
        "level" to it.level,
        "secure" to listOf("WPA", "WEP", "SAE", "PSK").any { k -> it.capabilities.contains(k) },
      )
    }
  }

  /** Le Wi-Fi auquel le téléphone est connecté (null si Android ne le dit pas). */
  @Suppress("DEPRECATION")
  fun currentSsid(): String? {
    val ssid = wifi.connectionInfo?.ssid?.trim('"') ?: return null
    return ssid.takeUnless { it.isBlank() || it == "<unknown ssid>" }
  }

  fun isWifiOn(): Boolean = wifi.isWifiEnabled

  /** Localisation activée (nécessaire au scan Wi-Fi sur Android 10 à 12). */
  fun isLocationOn(): Boolean {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return if (Build.VERSION.SDK_INT >= 28) lm.isLocationEnabled else true
  }

  /** Android sait-il se connecter au réseau d'une lumière depuis l'appli (Android 10+) ? */
  fun canConnectFromApp(): Boolean = Build.VERSION.SDK_INT >= 29

  /** Se connecte au réseau de la lumière ; `done(true)` une fois connecté, `done(false)` si refusé ou introuvable. */
  fun connect(ssid: String, password: String?, timeoutMs: Int, done: (Boolean) -> Unit) {
    release()
    if (Build.VERSION.SDK_INT < 29) return done(false)
    val specifier = WifiNetworkSpecifier.Builder().setSsid(ssid).apply {
      if (!password.isNullOrEmpty()) setWpa2Passphrase(password)
    }.build()
    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .setNetworkSpecifier(specifier)
      .build()
    var answered = false
    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        apNetwork = network
        if (!answered) { answered = true; done(true) }
      }
      override fun onUnavailable() {
        if (!answered) { answered = true; done(false) }
      }
      override fun onLost(network: Network) {
        if (apNetwork == network) apNetwork = null
      }
    }
    apCallback = callback
    connectivity.requestNetwork(request, callback, timeoutMs)
  }

  /**
   * Requête HTTP vers la lumière, par son réseau. Renvoie [statut, corps] ; statut -1 si la lumière a coupé en route
   * (normal : elle redémarre pour rejoindre la maison), -2 si on n'a pas pu la joindre du tout.
   */
  fun http(method: String, url: String, body: String?, contentType: String?, timeoutMs: Int): List<Any> {
    val target = URL(url)
    val conn = (apNetwork?.openConnection(target) ?: target.openConnection()) as HttpURLConnection
    return try {
      conn.requestMethod = method
      conn.connectTimeout = timeoutMs
      conn.readTimeout = timeoutMs
      if (body != null) {
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", contentType ?: "application/x-www-form-urlencoded")
      }
      try {
        conn.connect()
      } catch (e: IOException) {
        return listOf(-2, e.message ?: "")
      }
      if (body != null) conn.outputStream.use { it.write(body.toByteArray()) }
      val status = conn.responseCode
      val text = (if (status < 400) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText().take(2000) } ?: ""
      listOf(status, text)
    } catch (e: IOException) {
      listOf(-1, e.message ?: "")
    } finally {
      conn.disconnect()
    }
  }

  /** Messages UDP envoyés un à un à la lumière (Magic Home), par son réseau ; renvoie ce qu'elle a répondu. */
  fun udp(host: String, port: Int, messages: List<String>, waitMs: Int): List<String> {
    val replies = mutableListOf<String>()
    DatagramSocket().use { socket ->
      apNetwork?.bindSocket(socket)
      socket.soTimeout = waitMs
      val address = InetAddress.getByName(host)
      val buf = ByteArray(512)
      for (message in messages) {
        val data = message.toByteArray()
        socket.send(DatagramPacket(data, data.size, address, port))
        try {
          val packet = DatagramPacket(buf, buf.size)
          socket.receive(packet)
          replies.add(String(packet.data, 0, packet.length))
        } catch (_: SocketTimeoutException) {
          replies.add("")
        }
      }
    }
    return replies
  }

  /** Quitte le réseau de la lumière : le téléphone revient tout seul sur le Wi-Fi de la maison. */
  fun release() {
    apCallback?.let { runCatching { connectivity.unregisterNetworkCallback(it) } }
    apCallback = null
    apNetwork = null
  }
}
