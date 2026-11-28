package expo.modules.ledstripnative

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

/**
 * Secouer le téléphone = « Signaler un problème » (standard du studio). Une vraie secousse : deux à-coups de plus de
 * 2,7 g en moins d'une demi-seconde ; ensuite plus rien pendant 3 s (une seule question par secousse).
 */
internal class ShakeDetector(context: Context, private val onShake: () -> Unit) : SensorEventListener {
  private val sensors = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private var lastPeak = 0L
  private var lastShake = 0L

  fun start() {
    sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let { sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_UI) }
  }

  fun stop() = sensors.unregisterListener(this)

  override fun onSensorChanged(event: SensorEvent) {
    val (x, y, z) = event.values
    val g = sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH
    if (g < 2.7f) return
    val now = System.currentTimeMillis()
    if (now - lastShake < 3000) return
    if (now - lastPeak in 80..500) {
      lastShake = now
      onShake()
    }
    lastPeak = now
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
