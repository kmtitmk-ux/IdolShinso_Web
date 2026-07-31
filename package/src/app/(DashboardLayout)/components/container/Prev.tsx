"use client";
import { useRouter } from "next/navigation";
import { Button } from "@mui/material";
export default function Prev() {
  const router = useRouter();
  return (
    <Button onClick={() => router.back()}>前のページ</Button>
  );
}

