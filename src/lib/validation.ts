import { z } from "zod";

export const guestBootstrapSchema = z.object({});

export const postSchema = z.object({
  body: z.string().trim().max(1000).default(""),
  mediaUrl: z
    .string()
    .regex(/^\/api\/media\/[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm)$/i, "Choose an uploaded media file.")
    .optional(),
  mediaType: z.enum(["image", "video"]).optional(),
}).refine((value) => value.body.length > 0 || Boolean(value.mediaUrl), {
  message: "Write a post or attach an image/video.",
  path: ["body"],
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(600),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(48),
  bio: z.string().trim().max(180),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const conversationSchema = z.object({
  userId: z.string().min(1).max(64),
});
