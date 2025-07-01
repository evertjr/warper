import React, { useRef } from "react";
import { useWarperContext } from "../context/WarperContext";

export function ImageLoader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleImageUpload } = useWarperContext();

  const handleLoadNewImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    handleImageUpload(event.target.files[0]);
    event.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleLoadNewImage}
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden="true"
      >
        Load Image
      </button>
    </>
  );
}
