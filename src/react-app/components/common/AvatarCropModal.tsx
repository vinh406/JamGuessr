import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Modal } from "./Modal";
import { Button } from "../ui/Button";

interface AvatarCropModalProps {
  imageUrl: string;
  onConfirm: (blob: Blob) => Promise<void>;
  onCancel: () => void;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.95,
    );
  });
}

export default function AvatarCropModal({ imageUrl, onConfirm, onCancel }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);
    try {
      const blob = await getCroppedBlob(imageUrl, croppedAreaPixels);
      await onConfirm(blob);
    } catch {
      setLoading(false);
    }
  };

  return (
    <Modal title="Crop Avatar" onClose={onCancel} maxWidth="md">
      <div className="relative w-full" style={{ height: 360 }}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="flex items-center gap-4 py-3">
        <span className="text-gray-400 text-sm">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-green-500"
        />
        <span className="text-gray-400 text-sm">{zoom}x</span>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleApply} disabled={loading}>
          {loading ? "Processing..." : "Apply"}
        </Button>
      </div>
    </Modal>
  );
}
