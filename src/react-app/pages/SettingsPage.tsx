import { useState, useRef, lazy, Suspense } from "react";
import PageLayout from "../components/common/PageLayout";
import { Button, Input, DefaultAvatar } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";

const AvatarCropModal = lazy(() => import("../components/common/AvatarCropModal"));

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameChanged = displayName !== user?.name;
  const canSave = !saving && displayName.trim().length > 0 && nameChanged;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Allowed: jpeg, png, gif, webp");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 2MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropImageUrl(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/user/avatar", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to upload avatar");
      }
      const data = await res.json();
      const cacheBuster = `${data.imageUrl}?t=${Date.now()}`;
      updateUser({ image: cacheBuster });
      toast.success("Profile picture updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to update profile");
      }
      const data = await res.json();
      updateUser({ name: data.name });
      toast.success("Display name updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout>
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shrink-0">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
        </div>

        <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-8 space-y-8">
          <div>
            <h2 className="text-lg font-bold text-white mb-6">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="relative flex items-center justify-center p-0 leading-none overflow-hidden rounded-full ring-2 ring-green-500/30 hover:ring-green-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <DefaultAvatar name={user?.name} src={user?.image} size={96} />
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                      <svg
                        className="w-8 h-8 text-white animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
              <div className="text-gray-400 text-sm">
                <p>Click the avatar to change your profile picture.</p>
                <p className="mt-1">Supported: JPEG, PNG, GIF, WebP (max 2MB)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-4">Display Name</h2>
            <Input
              variant="primary"
              size="lg"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
            <p className="text-gray-400 text-sm mt-2">
              This is how other players see you in games.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" disabled={!canSave} onClick={handleSaveName}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </main>

      {cropImageUrl && (
        <Suspense fallback={null}>
          <AvatarCropModal
            imageUrl={cropImageUrl}
            onConfirm={handleCropConfirm}
            onCancel={() => setCropImageUrl(null)}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}
