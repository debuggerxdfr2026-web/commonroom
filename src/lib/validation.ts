import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only.")
    .transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(48),
  password: z
    .string()
    .min(10)
    .max(72)
    .refine((value) => new TextEncoder().encode(value).length <= 72, "Password is too long."),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});

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
