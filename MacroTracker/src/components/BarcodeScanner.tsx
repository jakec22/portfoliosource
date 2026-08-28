import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../theme/useTheme';

type ScanMode = 'barcode' | 'label';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  // Fired with a base64 JPEG when the user captures a Nutrition Facts label
  // in "Label" mode, so the caller can read exact macros off the label
  // instead of trusting a barcode database lookup.
  onLabelCaptured: (base64: string) => void;
}

export function BarcodeScanner({ visible, onClose, onScanned, onLabelCaptured }: Props) {
  // The scanner overlay stays fixed dark regardless of the active theme pack
  // (standard for a camera viewfinder), but the accent — button + scan frame
  // — follows the pack's primary color.
  const c = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  // Prevents the camera from firing dozens of callbacks for one barcode.
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<ScanMode>('barcode');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  function handleScanned(result: { data: string }) {
    if (locked) return;
    setLocked(true);
    onScanned(result.data);
  }

  // Re-arm the scanner whenever the modal is (re)opened.
  function handleShow() {
    setLocked(false);
    setMode('barcode');
    setCapturing(false);
  }

  async function handleCapture() {
    // Deliberately not gated on an onCameraReady flag: that event isn't
    // needed by barcode scanning, so it going unfired here made this button
    // permanently disabled with zero feedback and no way to diagnose it. If
    // the camera genuinely isn't ready, takePictureAsync itself throws and
    // the catch below surfaces that instead of silence.
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5 });
      if (photo?.base64) {
        onLabelCaptured(photo.base64);
      } else {
        Alert.alert('Capture failed', 'No photo was captured. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Capture failed', e?.message ?? 'Please try again.');
    } finally {
      setCapturing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onShow={handleShow} onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permTitle}>Camera Access Needed</Text>
            <Text style={styles.permText}>
              Allow camera access to scan food barcodes and labels.
            </Text>
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: c.primary }]}
              onPress={requestPermission}
            >
              <Text style={[styles.permBtnText, { color: c.onPrimary }]}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              // Keep this settings object stable across mode switches — toggling it
              // on/off forces the native capture session to reconfigure, which was
              // leaving takePictureAsync briefly unable to capture right after
              // switching into Label mode. Gating onBarcodeScanned below is enough
              // to stop barcode scans from being acted on outside Barcode mode.
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={mode === 'barcode' && !locked ? handleScanned : undefined}
            />

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              {(['barcode', 'label'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, mode === m && { backgroundColor: c.primary }]}
                  onPress={() => setMode(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                    {m === 'barcode' ? 'Barcode' : 'Nutrition Label'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'barcode' ? (
              <View style={styles.overlay} pointerEvents="none">
                <View style={[styles.frame, { borderColor: c.primary }]} />
                <Text style={styles.hint}>Point the camera at a product barcode</Text>
              </View>
            ) : (
              <>
                <View style={styles.overlay} pointerEvents="none">
                  <View style={[styles.labelFrame, { borderColor: c.primary }]} />
                  <Text style={styles.hint}>Frame the Nutrition Facts label, then capture</Text>
                </View>
                <View style={styles.shutterWrap}>
                  <TouchableOpacity
                    style={[styles.shutterBtn, { borderColor: c.primary }]}
                    onPress={handleCapture}
                    disabled={capturing}
                    activeOpacity={0.8}
                  >
                    {capturing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={[styles.shutterInner, { backgroundColor: c.primary }]} />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#111827',
  },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  permText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permBtnText: { fontSize: 16, fontWeight: '700' },
  cancelLink: { marginTop: 16 },
  cancelLinkText: { color: '#9CA3AF', fontSize: 14 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  labelFrame: {
    width: 260,
    height: 340,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  modeToggle: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 3,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 17,
  },
  modeBtnText: { color: '#D1D5DB', fontSize: 13, fontWeight: '700' },
  modeBtnTextActive: { color: '#fff' },
  shutterWrap: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
