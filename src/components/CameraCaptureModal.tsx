import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, FlipHorizontal, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  title: string;
  type: 'photo' | 'signature';
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title,
  type,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isLoading, setIsLoading] = useState(true);

  // Start camera when opened
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setCameraError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    setIsLoading(true);
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      let message = 'Unable to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device.';
      } else if (err.message) {
        message = err.message;
      }
      setCameraError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front-facing camera for natural selfie orientation
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    // If passport photo, crop or take clean center 3:4 portrait
    if (type === 'photo') {
      const targetAspect = 3 / 4;
      let cropWidth = width;
      let cropHeight = width / targetAspect;

      if (cropHeight > height) {
        cropHeight = height;
        cropWidth = height * targetAspect;
      }

      const cropX = (width - cropWidth) / 2;
      const cropY = (height - cropHeight) / 2;

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = 480;
      croppedCanvas.height = 640;
      const cropCtx = croppedCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.imageSmoothingEnabled = true;
        cropCtx.imageSmoothingQuality = 'high';
        cropCtx.fillStyle = '#ffffff';
        cropCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
        cropCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          croppedCanvas.width,
          croppedCanvas.height
        );
        const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        return;
      }
    } else {
      // Signature camera capture: crop center narrow box
      const sigAspect = 300 / 130;
      let cropWidth = width * 0.75;
      let cropHeight = cropWidth / sigAspect;

      if (cropHeight > height) {
        cropHeight = height * 0.8;
        cropWidth = cropHeight * sigAspect;
      }

      const cropX = (width - cropWidth) / 2;
      const cropY = (height - cropHeight) / 2;

      const sigCanvas = document.createElement('canvas');
      sigCanvas.width = 600;
      sigCanvas.height = 260;
      const sigCtx = sigCanvas.getContext('2d');
      if (sigCtx) {
        sigCtx.imageSmoothingEnabled = true;
        sigCtx.imageSmoothingQuality = 'high';
        sigCtx.fillStyle = '#ffffff';
        sigCtx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
        sigCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          sigCanvas.width,
          sigCanvas.height
        );
        const dataUrl = sigCanvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        return;
      }
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-[11px] text-slate-500">
                {type === 'photo'
                  ? 'Align face within the passport framing guide'
                  : 'Capture clear signature against plain background'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-black flex items-center justify-center min-h-[320px] max-h-[440px] overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white mb-1">Camera Not Available</p>
              <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
              </button>
            </div>
          ) : capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center p-2 bg-slate-950">
              <img
                src={capturedImage}
                alt="Captured"
                className="max-h-[380px] max-w-full rounded-lg object-contain shadow-lg border border-slate-700"
              />
              <div className="absolute top-4 left-4 bg-emerald-500/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1.5 backdrop-blur-sm">
                <Check className="w-3.5 h-3.5" /> Photo Captured
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover max-h-[400px] ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Passport Photo Framing Guide */}
              {type === 'photo' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Subtle darkening vignette */}
                  <div className="absolute inset-0 bg-black/35" />

                  {/* Cutout Container */}
                  <div className="relative w-[210px] h-[280px] rounded-2xl border-2 border-dashed border-rose-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-3">
                    {/* Head / Face Oval Guide */}
                    <div className="w-[140px] h-[175px] rounded-[50%/55%] border-2 border-rose-300/80 mt-2 relative">
                      {/* Eye Line Guide */}
                      <div className="absolute top-[45%] left-2 right-2 border-t border-rose-300/40" />
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-rose-300 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                        Head & Face
                      </div>
                    </div>

                    {/* Shoulder Guide Arc */}
                    <div className="w-[190px] h-[40px] border-t-2 border-rose-300/60 rounded-t-[50%] mb-1 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-rose-300 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                        Shoulders
                      </div>
                    </div>

                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-rose-400" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-rose-400" />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-rose-400" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-rose-400" />
                  </div>

                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-[11px] font-medium bg-black/70 text-slate-200 px-3 py-1 rounded-full backdrop-blur-sm">
                      Position face inside oval with natural neutral lighting
                    </span>
                  </div>
                </div>
              )}

              {/* Signature Capture Guide */}
              {type === 'signature' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[300px] h-[130px] rounded-xl border-2 border-dashed border-sky-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-sky-200 bg-black/60 px-2 py-1 rounded">
                      Align signature inside box
                    </span>
                  </div>
                </div>
              )}

              {/* Flip camera toggle button */}
              <button
                type="button"
                onClick={handleFlipCamera}
                className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-sm border border-slate-700 transition-colors shadow-md"
                title="Switch Camera (Front/Rear)"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retake
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Check className="w-3.5 h-3.5" /> Use Photo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(cameraError) || isLoading}
                onClick={handleTakeSnapshot}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
              >
                <Camera className="w-4 h-4" />
                <span>Take Snapshot</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
