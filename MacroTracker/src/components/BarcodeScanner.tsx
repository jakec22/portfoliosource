import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../theme/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}

export function BarcodeScanner({ visible, onClose, onScanned }: Props) {
  // The scanner overlay stays fixed dark regardless of the active theme pack
  // (standard for a camera viewfinder), but the accent — button + scan frame
  // — follows the pack's primary color.
  const c = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  // Prevents the camera from firing dozens of callbacks for one barcode.
  const [locked, setLocked] = useState(false);

  function handleScanned(result: { data: string }) {
    if (locked) return;
    setLocked(true);
    onScanned(result.data);
  }

  // Re-arm the scanner whenever the modal is (re)opened.
  function handleShow() {
    setLocked(false);
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
              Allow camera access to scan food barcodes.
            </Text>
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: c.primary }]}
              onPress={requestPermission}
            >
              <Text style={styles.permBtnText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
              }}
              onBarcodeScanned={locked ? undefined : handleScanned}
            />
            {/* Scan frame overlay */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={[styles.frame, { borderColor: c.primary }]} />
              <Text style={styles.hint}>Point the camera at a product barcode</Text>
            </View>
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
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
  hint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
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
