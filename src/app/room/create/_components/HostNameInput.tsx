"use client";

import { Input } from "@/components/ui/Input";
import { EmojiPicker } from "./EmojiPicker";

interface HostNameInputProps {
  name: string;
  onNameChange: (v: string) => void;
  avatar: string;
  onAvatarChange: (emoji: string) => void;
  nameError?: string;
  disabled?: boolean;
}

export function HostNameInput({
  name,
  onNameChange,
  avatar,
  onAvatarChange,
  nameError,
  disabled,
}: HostNameInputProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* Selected avatar preview */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold bg-gold/10 text-3xl">
          {avatar}
        </div>
        <div className="flex-1">
          <Input
            label="Your display name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="How others will see you"
            maxLength={40}
            showCount
            error={nameError}
            disabled={disabled}
            autoComplete="nickname"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-white">Pick an avatar</p>
        <EmojiPicker value={avatar} onChange={onAvatarChange} disabled={disabled} />
      </div>
    </div>
  );
}
