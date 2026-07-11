package cool.ride.app.plugins;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlsPlugin")
public class AlsPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor lightSensor;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext()
            .getSystemService(Context.SENSOR_SERVICE);
        lightSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (lightSensor == null) {
            call.reject("Light sensor not available on this device");
            return;
        }
        sensorManager.registerListener(this, lightSensor,
            SensorManager.SENSOR_DELAY_NORMAL);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        sensorManager.unregisterListener(this);
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float lux = event.values[0];
        JSObject data = new JSObject();
        data.put("lux", lux);
        notifyListeners("luxChanged", data);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    @Override
    protected void handleOnPause() {
        if (lightSensor != null) {
            sensorManager.unregisterListener(this);
        }
    }
}
