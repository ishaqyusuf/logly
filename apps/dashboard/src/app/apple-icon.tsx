import { BrandAppIcon } from "@logly/ui/brand";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandAppIcon size={size.width} />, size);
}
