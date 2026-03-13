package io.halalscanner.ai;

import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            
            // Optimizations for smoother experience
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setUseWideViewPort(true);
            settings.setSaveFormData(true);
            
            // Hardware acceleration
            webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
        }
    }
}
