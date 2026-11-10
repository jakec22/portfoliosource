import React, { useMemo, useRef, useState } from 'react';
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
import { useSheetAnimation } from '../hooks/useSheetAnimation';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from './Icon';

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
  const styles = useMemo(() => makeStyles(c), [c]);
  const sheetAnimation = useSheetAnimation();
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
    <Modal visible={visible} animationType={sheetAnimation} onShow={handleShow} onRequestClose={onClose}>
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
              <Icon name="close" size="sm" color="#fff" />
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

/**
 * Camera chrome, deliberately outside the theme packs.
 *
 * This sits over a live viewfinder, where the surface has to stay dark and
 * neutral whatever pack is active — a pack is free to go light later, and
 * this screen cannot follow it there. So the values are named here as a
 * declared exception rather than pulled from `c`.
 *
 * They were four loose Tailwind greys (gray-900/400/300) left over from
 * before the token system; naming them is what makes the exception readable
 * as a decision instead of as drift. Contrast is measured against the chrome
 * itself: `camText` is 7.0:1 on `camSurface`, `camTextStrong` 14.3:1 on the
 * black viewfinder.
 */
const cam = {
  surface: '#111827', // panel behind the permission prompt
  text: '#9CA3AF', // body copy on that panel
  textStrong: '#D1D5DB', // controls over the live feed
  white: '#FFFFFF',
  black: '#000000', // the viewfinder itself
} as const;

const makeStyles = (c: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: cam.black },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    backgroundColor: cam.surface,
  },
  permTitle: { ...type.heading(c), color: cam.white, marginBottom: space.sm },
  permText: { ...type.body(c), color: cam.text, textAlign: 'center', marginBottom: space.xl },
  permBtn: {
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.control,
  },
  permBtnText: { ...type.bodyStrong(c) },
  cancelLink: { marginTop: space.lg },
  cancelLinkText: { ...type.body(c), color: cam.text },
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
    borderRadius: radius.card,
    backgroundColor: 'transparent',
  },
  labelFrame: {
    width: 260,
    height: 340,
    borderWidth: 3,
    borderRadius: radius.card,
    backgroundColor: 'transparent',
  },
  hint: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: cam.white,
    marginTop: space.lg,
    textAlign: 'center',
    paddingHorizontal: space.xxl,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  modeToggle: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.card,
    padding: space.xs,
  },
  modeBtn: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.control,
  },
  modeBtnText: { ...type.captionStrong(c), fontFamily: c.fontBodyBold, color: cam.textStrong },
  modeBtnTextActive: { color: cam.white },
  shutterWrap: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.card,
  },
  closeBtnText: { ...type.body(c), fontFamily: c.fontBodySemi, color: cam.white },
  });
