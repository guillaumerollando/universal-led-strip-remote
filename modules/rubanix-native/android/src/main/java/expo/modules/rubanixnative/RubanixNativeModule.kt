package expo.modules.rubanixnative

import android.content.Context
import android.hardware.ConsumerIrManager
import android.net.wifi.WifiManager
import java.io.ByteArrayOutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal class NoIrEmitterException :
  CodedException("Ce téléphone n'a pas d'émetteur infrarouge")

/**
 * Accès natif dont l'appli a besoin et qu'Expo ne fournit pas :
 * l'émetteur infrarouge (ConsumerIrManager) et le verrou multicast Wi-Fi,
 * sans lequel Android jette les paquets de découverte (Govee, mDNS).
 */
class RubanixNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val irManager: ConsumerIrManager?
    get() = context.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager

  private var multicastLock: WifiManager.MulticastLock? = null

  override fun definition() = ModuleDefinition {
    Name("RubanixNative")

    Function("hasIrEmitter") {
      irManager?.hasIrEmitter() == true
    }

    /** Plages de fréquences porteuses supportées, en Hz : [[min, max], ...]. */
    Function("getIrCarrierFrequencies") {
      irManager?.carrierFrequencies?.map { listOf(it.minFrequency, it.maxFrequency) } ?: emptyList<List<Int>>()
    }

    /** Émet un motif marche/arrêt en microsecondes sur une porteuse donnée. */
    AsyncFunction("transmitIr") { frequency: Int, pattern: List<Int> ->
      val ir = irManager
      if (ir == null || !ir.hasIrEmitter()) throw NoIrEmitterException()
      ir.transmit(frequency, pattern.toIntArray())
    }

    /**
     * Émet plusieurs trames, une par appel à transmit(), au rythme de `periodMs` entre le début de deux trames.
     * Indispensable sur les Xiaomi récents : le pilote ir-spi refuse en silence tout appel de plus d'environ 108 ms
     * (tampon de 4096 périodes de porteuse) ; une rafale doit donc être découpée en appels successifs.
     */
    AsyncFunction("transmitSequence") { frequency: Int, frames: List<List<Int>>, periodMs: Int ->
      val ir = irManager
      if (ir == null || !ir.hasIrEmitter()) throw NoIrEmitterException()
      // Durée de chaque appel, en µs : le pilote attend la fin réelle de l'émission, donc une trame de ~68 ms
      // émise prend ~68 ms ; un appel refusé en silence revient presque tout de suite (diagnostic).
      val durations = mutableListOf<Long>()
      for (frame in frames) {
        val start = System.nanoTime()
        ir.transmit(frequency, frame.toIntArray())
        val elapsedUs = (System.nanoTime() - start) / 1_000
        durations.add(elapsedUs)
        val elapsedMs = elapsedUs / 1_000
        if (elapsedMs < periodMs) Thread.sleep(periodMs - elapsedMs)
      }
      durations
    }

    /**
     * Requête TCP courte (Magic Home 5577, Yeelight 55443) : se connecte, envoie `payload`, puis lit la réponse
     * jusqu'à `replyBytes` octets (0 = ne rien lire, -1 = jusqu'au premier saut de ligne) ou `timeoutMs`.
     * Renvoie les octets lus (peut-être aucun si l'appareil ne répond pas).
     */
    AsyncFunction("tcpRequest") { host: String, port: Int, payload: List<Int>, replyBytes: Int, timeoutMs: Int ->
      Socket().use { socket ->
        socket.connect(InetSocketAddress(host, port), timeoutMs)
        socket.soTimeout = timeoutMs
        val out = socket.getOutputStream()
        out.write(ByteArray(payload.size) { payload[it].toByte() })
        out.flush()
        val received = ByteArrayOutputStream()
        if (replyBytes != 0) {
          val input = socket.getInputStream()
          val buf = ByteArray(256)
          try {
            while (replyBytes < 0 || received.size() < replyBytes) {
              val n = input.read(buf)
              if (n <= 0) break
              received.write(buf, 0, n)
              if (replyBytes < 0 && buf.take(n).contains('\n'.code.toByte())) break
            }
          } catch (_: SocketTimeoutException) {
            // L'appareil a répondu moins que prévu : on renvoie ce qu'on a.
          }
        }
        received.toByteArray().map { it.toInt() and 0xff }
      }
    }

    /** Pousse les pièces (JSON : [{name, on, link, label}]) et le texte « aucune pièce » au widget, puis le redessine. */
    Function("setWidgetRooms") { rooms: String, empty: String ->
      context.getSharedPreferences(LedStripWidget.PREFS, Context.MODE_PRIVATE).edit()
        .putString("rooms", rooms).putString("empty", empty).apply()
      LedStripWidget.refresh(context)
    }

    /** Pousse les pièces et leurs ambiances (JSON) aux widgets « Pièce » et « Ambiance », puis les redessine. */
    Function("setWidgetPlaces") { places: String, empty: String ->
      PlaceWidgets.prefs(context).edit().putString("places", places).putString("empty", empty).apply()
      PlaceWidgets.refreshAll(context)
    }

    /** Propose de poser un widget « Pièce » ou « Ambiance » sur l'écran d'accueil (false si le lanceur ne sait pas). */
    Function("pinWidget") { kind: String, roomId: String, sceneId: String ->
      PlaceWidgets.pin(context, kind, roomId, sceneId)
    }

    /** Remet l'appli en arrière-plan (après une action lancée depuis le widget). */
    Function("moveToBack") {
      appContext.currentActivity?.moveTaskToBack(true) ?: false
    }

    Function("acquireMulticastLock") {
      if (multicastLock == null) {
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("ledstrip-discovery").apply { setReferenceCounted(false) }
      }
      multicastLock?.acquire()
    }

    Function("releaseMulticastLock") {
      multicastLock?.takeIf { it.isHeld }?.release()
    }

    OnDestroy {
      multicastLock?.takeIf { it.isHeld }?.release()
    }
  }
}
