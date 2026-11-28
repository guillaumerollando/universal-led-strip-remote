package expo.modules.ledstripnative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

/**
 * Widgets « Pièce » (une pièce : interrupteur + ses ambiances) et « Ambiance » (une ambiance d'une pièce, un seul
 * gros bouton à ses couleurs). On les pose depuis l'appli (appui long sur une pièce ou une ambiance) : Android demande
 * confirmation, puis rappelle `PIN_DONE` avec le numéro du widget, qu'on relie à la pièce / l'ambiance choisie.
 * Comme le widget « Pièces », ils ne pilotent rien eux-mêmes : ils ouvrent un lien `ledstrip://…&from=widget`.
 */
object PlaceWidgets {
  const val PREFS = "ledstrip_places"
  const val ACTION_PIN_DONE = "expo.modules.ledstripnative.PIN_DONE"

  fun places(context: Context): JSONArray =
    runCatching { JSONArray(prefs(context).getString("places", "[]")) }.getOrDefault(JSONArray())

  fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun place(context: Context, roomId: String?): JSONObject? {
    if (roomId == null) return null
    val all = places(context)
    for (i in 0 until all.length()) if (all.getJSONObject(i).optString("id") == roomId) return all.getJSONObject(i)
    return null
  }

  fun scene(place: JSONObject?, sceneId: String?): JSONObject? {
    val scenes = place?.optJSONArray("scenes") ?: return null
    for (i in 0 until scenes.length()) if (scenes.getJSONObject(i).optString("id") == sceneId) return scenes.getJSONObject(i)
    return null
  }

  /** Ce qu'un widget posé montre : `room` et éventuellement `scene`. */
  fun config(context: Context, widgetId: Int): JSONObject? =
    prefs(context).getString("cfg_$widgetId", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  fun link(context: Context, uri: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Bouton aux couleurs de l'ambiance : dégradé en diagonale, coins arrondis, voile sombre pour lire le texte. */
  fun gradient(colors: JSONArray?, width: Int, height: Int, radius: Float): Bitmap {
    val list = (0 until (colors?.length() ?: 0)).mapNotNull { runCatching { Color.parseColor(colors!!.getString(it)) }.getOrNull() }
      .ifEmpty { listOf(Color.parseColor("#FFB547")) }
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val rect = RectF(0f, 0f, width.toFloat(), height.toFloat())
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val stops = if (list.size == 1) intArrayOf(list[0], list[0]) else list.toIntArray()
    paint.shader = LinearGradient(0f, 0f, width.toFloat(), height.toFloat(), stops, null, Shader.TileMode.CLAMP)
    canvas.drawRoundRect(rect, radius, radius, paint)
    paint.shader = null
    paint.color = Color.argb(70, 0, 0, 0)
    canvas.drawRoundRect(rect, radius, radius, paint)
    return bitmap
  }

  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    for (cls in listOf(RoomWidget::class.java, AmbianceWidget::class.java)) {
      val ids = manager.getAppWidgetIds(ComponentName(context, cls))
      for (id in ids) manager.updateAppWidget(id, if (cls == RoomWidget::class.java) RoomWidget.render(context, id) else AmbianceWidget.render(context, id))
    }
  }

  /** Demande au lanceur de poser un widget ; false s'il ne sait pas (le texte de l'appli explique alors comment faire). */
  fun pin(context: Context, kind: String, roomId: String, sceneId: String): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    val manager = context.getSystemService(AppWidgetManager::class.java) ?: return false
    if (!manager.isRequestPinAppWidgetSupported) return false
    val cls = if (kind == "room") RoomWidget::class.java else AmbianceWidget::class.java
    val cfg = JSONObject().put("room", roomId).put("scene", sceneId).toString()
    val callback = Intent(context, cls).setAction(ACTION_PIN_DONE).putExtra("cfg", cfg)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    val pending = PendingIntent.getBroadcast(context, (kind + roomId + sceneId).hashCode(), callback, flags)
    return manager.requestPinAppWidget(ComponentName(context, cls), null, pending)
  }

  /** Commun aux deux widgets : relier le widget posé à sa pièce / son ambiance, et oublier les widgets retirés. */
  fun onReceive(context: Context, intent: Intent, render: (Int) -> RemoteViews) {
    if (intent.action != ACTION_PIN_DONE) return
    val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    val cfg = intent.getStringExtra("cfg") ?: return
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return
    prefs(context).edit().putString("cfg_$id", cfg).apply()
    AppWidgetManager.getInstance(context).updateAppWidget(id, render(id))
  }

  fun forget(context: Context, ids: IntArray) {
    val edit = prefs(context).edit()
    for (id in ids) edit.remove("cfg_$id")
    edit.apply()
  }

  /** Widget pas (ou plus) relié : il dit comment le poser depuis l'appli, et ouvre l'appli. */
  fun empty(context: Context, layout: Int, rootId: Int, textId: Int, contentIds: List<Int>): RemoteViews {
    val views = RemoteViews(context.packageName, layout)
    for (v in contentIds) views.setViewVisibility(v, View.GONE)
    views.setViewVisibility(textId, View.VISIBLE)
    views.setTextViewText(textId, prefs(context).getString("empty", "") ?: "")
    views.setOnClickPendingIntent(rootId, link(context, "ledstrip://", 3000))
    return views
  }
}

/** Widget « Pièce » : son nom, son interrupteur, et ses trois premières ambiances à leurs couleurs. */
class RoomWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, render(context, id))
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    PlaceWidgets.onReceive(context, intent) { render(context, it) }
  }

  override fun onDeleted(context: Context, ids: IntArray) = PlaceWidgets.forget(context, ids)

  companion object {
    private val SCENES = listOf(
      Triple(R.id.ledstrip_room_scene0, R.id.ledstrip_room_scene0_bg, R.id.ledstrip_room_scene0_name),
      Triple(R.id.ledstrip_room_scene1, R.id.ledstrip_room_scene1_bg, R.id.ledstrip_room_scene1_name),
      Triple(R.id.ledstrip_room_scene2, R.id.ledstrip_room_scene2_bg, R.id.ledstrip_room_scene2_name),
    )

    fun render(context: Context, widgetId: Int): RemoteViews {
      val place = PlaceWidgets.place(context, PlaceWidgets.config(context, widgetId)?.optString("room"))
        ?: return PlaceWidgets.empty(
          context, R.layout.ledstrip_room_widget, R.id.ledstrip_room_root, R.id.ledstrip_room_empty,
          listOf(R.id.ledstrip_room_header, R.id.ledstrip_room_scenes),
        )
      val views = RemoteViews(context.packageName, R.layout.ledstrip_room_widget)
      val on = place.optBoolean("on")
      views.setViewVisibility(R.id.ledstrip_room_empty, View.GONE)
      views.setTextViewText(R.id.ledstrip_room_name, place.optString("name"))
      views.setImageViewResource(R.id.ledstrip_room_power, if (on) R.drawable.ledstrip_power_on else R.drawable.ledstrip_power_off)
      views.setInt(R.id.ledstrip_room_header, "setBackgroundResource", if (on) R.drawable.ledstrip_widget_row_on else R.drawable.ledstrip_widget_row)
      views.setContentDescription(R.id.ledstrip_room_header, place.optString("label"))
      val power = place.optString("link") + "&on=" + (if (on) "0" else "1") + "&from=widget"
      views.setOnClickPendingIntent(R.id.ledstrip_room_header, PlaceWidgets.link(context, power, widgetId * 10))
      val scenes = place.optJSONArray("scenes") ?: JSONArray()
      SCENES.forEachIndexed { i, (box, bg, name) ->
        if (i >= scenes.length()) {
          views.setViewVisibility(box, View.GONE)
          return@forEachIndexed
        }
        val scene = scenes.getJSONObject(i)
        views.setViewVisibility(box, View.VISIBLE)
        views.setImageViewBitmap(bg, PlaceWidgets.gradient(scene.optJSONArray("colors"), 300, 120, 36f))
        views.setTextViewText(name, scene.optString("name"))
        views.setContentDescription(box, scene.optString("name"))
        views.setOnClickPendingIntent(box, PlaceWidgets.link(context, scene.optString("link") + "&from=widget", widgetId * 10 + 1 + i))
      }
      return views
    }
  }
}

/** Widget « Ambiance » : un gros bouton aux couleurs de l'ambiance, son nom et celui de la pièce. */
class AmbianceWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, render(context, id))
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    PlaceWidgets.onReceive(context, intent) { render(context, it) }
  }

  override fun onDeleted(context: Context, ids: IntArray) = PlaceWidgets.forget(context, ids)

  companion object {
    fun render(context: Context, widgetId: Int): RemoteViews {
      val cfg = PlaceWidgets.config(context, widgetId)
      val place = PlaceWidgets.place(context, cfg?.optString("room"))
      val scene = PlaceWidgets.scene(place, cfg?.optString("scene"))
      if (place == null || scene == null) {
        return PlaceWidgets.empty(
          context, R.layout.ledstrip_ambiance_widget, R.id.ledstrip_ambiance_root, R.id.ledstrip_ambiance_empty,
          listOf(R.id.ledstrip_ambiance_bg, R.id.ledstrip_ambiance_name, R.id.ledstrip_ambiance_room),
        )
      }
      val views = RemoteViews(context.packageName, R.layout.ledstrip_ambiance_widget)
      views.setViewVisibility(R.id.ledstrip_ambiance_empty, View.GONE)
      views.setImageViewBitmap(R.id.ledstrip_ambiance_bg, PlaceWidgets.gradient(scene.optJSONArray("colors"), 400, 200, 56f))
      views.setTextViewText(R.id.ledstrip_ambiance_name, scene.optString("name"))
      views.setTextViewText(R.id.ledstrip_ambiance_room, place.optString("name"))
      views.setContentDescription(R.id.ledstrip_ambiance_root, scene.optString("name") + " · " + place.optString("name"))
      views.setOnClickPendingIntent(R.id.ledstrip_ambiance_root, PlaceWidgets.link(context, scene.optString("link") + "&from=widget", 2000 + widgetId))
      return views
    }
  }
}
