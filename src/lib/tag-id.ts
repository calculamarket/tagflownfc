import { customAlphabet } from "nanoid";

// Short, URL-safe IDs (~8 chars, 218 trillion combos)
export const newTagId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);
