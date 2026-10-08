package expo.modules.rubanixnative

import android.content.Context
import android.hardware.ConsumerIrManager
import android.net.wifi.WifiManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal class NoIrEmitterException :
  CodedException("Ce téléphone n'a pas d'émetteur infrarouge")

/**
 * Accès natif dont Rubanix a besoin et qu'Expo ne fournit pas :
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

    Function("acquireMulticastLock") {
      if (multicastLock == null) {
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("rubanix-discovery").apply { setReferenceCounted(false) }
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
