import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, FlipHorizontal, AlertCircle, Crop, Move } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  title: string;
  type: 'photo' | 'signature';
}

interface CropRect {
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  w: number; // percentage 0 - 100
  h: number; // percentage 0 - 100
}

const DEFAULT_SIGNATURE_CROP: CropRect = {
  x: 10,
  y: 20,
  w: 80,
  h: 60,
};

const DEFAULT_PHOTO_CROP: CropRect = {
  x: 20,
  y: 8,
  w: 60,
  h: 84,
};

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title,
  type,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<CropRect>(() =>
    type === 'photo' ? DEFAULT_PHOTO_CROP : DEFAULT_SIGNATURE_CROP
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isLoading, setIsLoading] = useState(true);

  // Dragging state for the crop box
  const dragRef = useRef<{
    isDragging: boolean;
    handleType: string;
    startX: number;
    startY: number;
    initialCrop: CropRect;
  } | null>(null);

  // Start camera when opened
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setIsCropping(false);
      setCameraError(null);
      setCrop(type === 'photo' ? DEFAULT_PHOTO_CROP : DEFAULT_SIGNATURE_CROP);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, type]);

  // Global pointer listeners for smooth dragging and resizing
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!dragRef.current || !dragRef.current.isDragging || !cropAreaRef.current) return;
      const rect = cropAreaRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
      const init = dragRef.current.initialCrop;
      const handleType = dragRef.current.handleType;
      const MIN_SIZE = 6; // minimum 6%

      let newX = init.x;
      let newY = init.y;
      let newW = init.w;
      let newH = init.h;

      if (handleType === 'move') {
        newX = Math.max(0, Math.min(100 - init.w, init.x + dx));
        newY = Math.max(0, Math.min(100 - init.h, init.y + dy));
      } else if (handleType === 'se') {
        newW = Math.max(MIN_SIZE, Math.min(100 - init.x, init.w + dx));
        newH = Math.max(MIN_SIZE, Math.min(100 - init.y, init.h + dy));
      } else if (handleType === 'sw') {
        const targetX = Math.max(0, Math.min(init.x + init.w - MIN_SIZE, init.x + dx));
        newW = init.w + (init.x - targetX);
        newX = targetX;
        newH = Math.max(MIN_SIZE, Math.min(100 - init.y, init.h + dy));
      } else if (handleType === 'ne') {
        newW = Math.max(MIN_SIZE, Math.min(100 - init.x, init.w + dx));
        const targetY = Math.max(0, Math.min(init.y + init.h - MIN_SIZE, init.y + dy));
        newH = init.h + (init.y - targetY);
        newY = targetY;
      } else if (handleType === 'nw') {
        const targetX = Math.max(0, Math.min(init.x + init.w - MIN_SIZE, init.x + dx));
        newW = init.w + (init.x - targetX);
        newX = targetX;
        const targetY = Math.max(0, Math.min(init.y + init.h - MIN_SIZE, init.y + dy));
        newH = init.h + (init.y - targetY);
        newY = targetY;
      } else if (handleType === 'n') {
        const targetY = Math.max(0, Math.min(init.y + init.h - MIN_SIZE, init.y + dy));
        newH = init.h + (init.y - targetY);
        newY = targetY;
      } else if (handleType === 's') {
        newH = Math.max(MIN_SIZE, Math.min(100 - init.y, init.h + dy));
      } else if (handleType === 'w') {
        const targetX = Math.max(0, Math.min(init.x + init.w - MIN_SIZE, init.x + dx));
        newW = init.w + (init.x - targetX);
        newX = targetX;
      } else if (handleType === 'e') {
        newW = Math.max(MIN_SIZE, Math.min(100 - init.x, init.w + dx));
      }

      setCrop({
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
        w: Math.round(newW * 10) / 10,
        h: Math.round(newH * 10) / 10,
      });
    };

    const handleGlobalPointerUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, []);

  // Live real-time preview generation for the cropped signature
  useEffect(() => {
    if (!capturedImage || !isCropping) return;

    const img = new Image();
    img.src = capturedImage;
    img.onload = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      const sx = Math.max(0, (crop.x / 100) * naturalW);
      const sy = Math.max(0, (crop.y / 100) * naturalH);
      const sw = Math.min(naturalW - sx, (crop.w / 100) * naturalW);
      const sh = Math.min(naturalH - sy, (crop.h / 100) * naturalH);

      if (sw <= 0 || sh <= 0) return;

      const maxPreviewW = 320;
      const scale = Math.min(1, maxPreviewW / sw);
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    };
  }, [capturedImage, crop, isCropping]);

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

    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);

    // Immediately open smooth image-cropping step for Employee Photo or Signature
    if (type === 'photo') {
      setCrop(DEFAULT_PHOTO_CROP);
      setIsCropping(true);
    } else if (type === 'signature') {
      setCrop(DEFAULT_SIGNATURE_CROP);
      setIsCropping(true);
    }
  };

  // User confirms cropped photo or signature
  const handleConfirmCrop = () => {
    if (!capturedImage) return;

    const img = new Image();
    img.src = capturedImage;
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      const sx = Math.max(0, (crop.x / 100) * naturalW);
      const sy = Math.max(0, (crop.y / 100) * naturalH);
      const sw = Math.min(naturalW - sx, (crop.w / 100) * naturalW);
      const sh = Math.min(naturalH - sy, (crop.h / 100) * naturalH);

      if (sw <= 0 || sh <= 0) return;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.round(sw);
      cropCanvas.height = Math.round(sh);
      const ctx = cropCanvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);

      const croppedDataUrl =
        type === 'photo'
          ? cropCanvas.toDataURL('image/jpeg', 0.95)
          : cropCanvas.toDataURL('image/png');

      onCapture(croppedDataUrl);
      setIsCropping(false);
      setCapturedImage(null);
      stopCamera();
      onClose();
    };
  };

  // User cancels cropping: discard crop, preserve previously saved image, close modal
  const handleCancelCrop = () => {
    setIsCropping(false);
    setCapturedImage(null);
    stopCamera();
    onClose();
  };

  // User retakes snapshot
  const handleRetakeSnapshot = () => {
    setIsCropping(false);
    setCapturedImage(null);
    setCrop(type === 'photo' ? DEFAULT_PHOTO_CROP : DEFAULT_SIGNATURE_CROP);
    if (!stream) {
      startCamera(facingMode);
    }
  };

  // Start dragging a handle or the box
  const handleStartDrag = (e: React.PointerEvent, handleType: string) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      isDragging: true,
      handleType,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...crop },
    };
  };

  // Click on container outside crop box: reposition box centered at click
  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (!cropAreaRef.current) return;
    const rect = cropAreaRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const w = type === 'photo' ? 50 : 60;
    const h = type === 'photo' ? 66.7 : 40;
    const x = Math.max(0, Math.min(100 - w, clickX - w / 2));
    const y = Math.max(0, Math.min(100 - h, clickY - h / 2));
    const newCrop = {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w,
      h,
    };
    setCrop(newCrop);

    dragRef.current = {
      isDragging: true,
      handleType: 'move',
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: newCrop,
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              {isCropping ? <Crop className="w-4 h-4 text-emerald-600" /> : <Camera className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isCropping
                  ? type === 'photo'
                    ? 'Crop Employee Photo'
                    : 'Crop Signature Image'
                  : title}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isCropping
                  ? type === 'photo'
                    ? 'Drag edges or corners to freely adjust the crop area around the employee photo'
                    : 'Drag edges or corners to freely adjust the crop area around your signature'
                  : type === 'photo'
                  ? 'Align face within the passport framing guide'
                  : 'Capture clear signature against plain background'}
              </p>
            </div>
          </div>
          <button
            onClick={isCropping ? handleCancelCrop : onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-black flex items-center justify-center min-h-[320px] max-h-[460px] overflow-hidden">
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
          ) : isCropping && capturedImage ? (
            /* Smooth Interactive Cropping Interface */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-3 bg-slate-950">
              {/* Quick Preset Toolbar */}
              <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Crop className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">
                    {type === 'photo' ? 'Photo Crop Presets' : 'Freeform Crop Area'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {type === 'photo' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setCrop({ x: 25, y: 10, w: 50, h: 66.7 })}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium transition-colors"
                      >
                        Portrait (3:4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrop({ x: 20, y: 10, w: 60, h: 60 })}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium transition-colors"
                      >
                        Square (1:1)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium transition-colors"
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrop(DEFAULT_PHOTO_CROP)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium transition-colors"
                      >
                        Reset
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setCrop({ x: 5, y: 15, w: 90, h: 70 })}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium transition-colors"
                      >
                        Wide
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium transition-colors"
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setCrop(DEFAULT_SIGNATURE_CROP)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium transition-colors"
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Cropping Stage */}
              <div className="relative inline-block max-w-full max-h-[290px] select-none rounded-lg overflow-hidden border border-slate-800 bg-black">
                <img
                  src={capturedImage}
                  alt="Captured for cropping"
                  className="max-h-[280px] max-w-full block object-contain select-none pointer-events-none"
                  draggable={false}
                />

                {/* Interactive Crop Overlay */}
                <div
                  ref={cropAreaRef}
                  onPointerDown={handleContainerPointerDown}
                  className="absolute inset-0 cursor-crosshair touch-none select-none"
                >
                  {/* Active Crop Bounding Box */}
                  <div
                    style={{
                      left: `${crop.x}%`,
                      top: `${crop.y}%`,
                      width: `${crop.w}%`,
                      height: `${crop.h}%`,
                    }}
                    className="absolute border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] cursor-move touch-none"
                    onPointerDown={(e) => handleStartDrag(e, 'move')}
                  >
                    {/* Subtle Rule-of-Thirds Grid */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div />
                    </div>

                    {/* Corner Handles */}
                    <div
                      className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-emerald-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md touch-none hover:scale-110 transition-transform"
                      onPointerDown={(e) => handleStartDrag(e, 'nw')}
                      title="Resize Top-Left"
                    />
                    <div
                      className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-emerald-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md touch-none hover:scale-110 transition-transform"
                      onPointerDown={(e) => handleStartDrag(e, 'ne')}
                      title="Resize Top-Right"
                    />
                    <div
                      className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-emerald-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md touch-none hover:scale-110 transition-transform"
                      onPointerDown={(e) => handleStartDrag(e, 'se')}
                      title="Resize Bottom-Right"
                    />
                    <div
                      className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-emerald-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md touch-none hover:scale-110 transition-transform"
                      onPointerDown={(e) => handleStartDrag(e, 'sw')}
                      title="Resize Bottom-Left"
                    />

                    {/* Edge Handles */}
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-emerald-400 border border-white rounded-full cursor-ns-resize shadow-xs touch-none"
                      onPointerDown={(e) => handleStartDrag(e, 'n')}
                      title="Resize Top"
                    />
                    <div
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-emerald-400 border border-white rounded-full cursor-ns-resize shadow-xs touch-none"
                      onPointerDown={(e) => handleStartDrag(e, 's')}
                      title="Resize Bottom"
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -left-1.5 h-8 w-2.5 bg-emerald-400 border border-white rounded-full cursor-ew-resize shadow-xs touch-none"
                      onPointerDown={(e) => handleStartDrag(e, 'w')}
                      title="Resize Left"
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -right-1.5 h-8 w-2.5 bg-emerald-400 border border-white rounded-full cursor-ew-resize shadow-xs touch-none"
                      onPointerDown={(e) => handleStartDrag(e, 'e')}
                      title="Resize Right"
                    />

                    {/* Center Drag Indicator */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                      <Move className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Result Preview */}
              <div className="w-full mt-2.5 p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Live Preview:
                  </span>
                  <div
                    className={`rounded px-2 py-0.5 flex items-center justify-center border shadow-inner ${
                      type === 'photo'
                        ? 'bg-slate-950 border-slate-700 max-h-16'
                        : 'bg-white border-slate-300 max-h-11'
                    }`}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      className={`${
                        type === 'photo' ? 'max-h-14 max-w-[120px] rounded' : 'max-h-9 max-w-[150px]'
                      } object-contain`}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-right">
                  <span>{Math.round(crop.w)}% &times; {Math.round(crop.h)}% area</span>
                </div>
              </div>
            </div>
          ) : (
            /* Live Camera Stream */
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
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="relative w-[210px] h-[280px] rounded-2xl border-2 border-dashed border-rose-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-3">
                    <div className="w-[140px] h-[175px] rounded-[50%/55%] border-2 border-rose-300/80 mt-2 relative">
                      <div className="absolute top-[45%] left-2 right-2 border-t border-rose-300/40" />
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-rose-300 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                        Head & Face
                      </div>
                    </div>
                    <div className="w-[190px] h-[40px] border-t-2 border-rose-300/60 rounded-t-[50%] mb-1 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-rose-300 font-bold bg-black/60 px-1.5 py-0.5 rounded">
                        Shoulders
                      </div>
                    </div>
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
          {isCropping ? (
            /* Controls for Cropping Step (Photo or Signature) */
            <>
              <button
                type="button"
                onClick={handleCancelCrop}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetakeSnapshot}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retake
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCrop}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" /> Confirm Crop
                </button>
              </div>
            </>
          ) : (
            /* Controls for Camera Capture */
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

