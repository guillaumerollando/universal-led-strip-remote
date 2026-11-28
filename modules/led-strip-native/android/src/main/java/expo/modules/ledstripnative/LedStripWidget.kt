package expo.modules.ledstripnative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray

/**
 * Widget « Pièces » de l'écran d'accueil : jusqu'à 4 pièces, un toucher allume ou éteint toute la pièce.
 * Il ne pilote rien lui-même : il ouvre le lien `ledstrip://power?…&from=widget`, que l'appli exécute puis
 * se remet en arrière-plan. Les pièces et leur état sont poussés par l'appli (`setWidgetRooms`).
 * Même rôle et mêmes données prévus pour le futur widget iPhone (WidgetKit + App Intents).
 */
class LedStripWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, render(context))
  }

  companion object {
    const val PREFS = "ledstrip_widget"
    private val ROWS = listOf(
      Triple(R.id.ledstrip_row0, R.id.ledstrip_name0, R.id.ledstrip_power0),
      Triple(R.id.ledstrip_row1, R.id.ledstrip_name1, R.id.ledstrip_power1),
      Triple(R.id.ledstrip_row2, R.id.ledstrip_name2, R.id.ledstrip_power2),
      Triple(R.id.ledstrip_row3, R.id.ledstrip_name3, R.id.ledstrip_power3),
    )

    /** Redessine tous les widgets posés (après un changement dans l'appli). */
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, LedStripWidget::class.java))
      if (ids.isNotEmpty()) manager.updateAppWidget(ids, render(context))
    }

    private fun render(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.ledstrip_widget)
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val rooms = runCatching { JSONArray(prefs.getString("rooms", "[]")) }.getOrDefault(JSONArray())
      views.setViewVisibility(R.id.ledstrip_empty, if (rooms.length() == 0) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.ledstrip_empty, prefs.getString("empty", "") ?: "")
      ROWS.forEachIndexed { i, (row, name, power) ->
        if (i >= rooms.length()) {
          views.setViewVisibility(row, View.GONE)
          return@forEachIndexed
        }
        val room = rooms.getJSONObject(i)
        val on = room.optBoolean("on")
        views.setViewVisibility(row, View.VISIBLE)
        views.setTextViewText(name, room.optString("name"))
        views.setImageViewResource(power, if (on) R.drawable.ledstrip_power_on else R.drawable.ledstrip_power_off)
        views.setInt(row, "setBackgroundResource", if (on) R.drawable.ledstrip_widget_row_on else R.drawable.ledstrip_widget_row)
        views.setContentDescription(row, room.optString("label"))
        // Le lien demande l'inverse de l'état connu : toucher une pièce allumée l'éteint.
        val uri = Uri.parse(room.optString("link") + "&on=" + (if (on) "0" else "1") + "&from=widget")
        val intent = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pending = PendingIntent.getActivity(context, 1000 + i, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        views.setOnClickPendingIntent(row, pending)
      }
      return views
    }
  }
}
