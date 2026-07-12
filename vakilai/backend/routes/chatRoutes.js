import express from "express";
import rateLimit from "express-rate-limit";
import {
  createChatHandler,
  listChatsHandler,
  searchChatsHandler,
  loadChatHandler,
  saveMessageHandler,
  renameChatHandler,
  archiveChatHandler,
  deleteChatHandler,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many search requests.", code: "SEARCH_RATE_LIMITED" },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many requests.", code: "WRITE_RATE_LIMITED" },
});

router.use(protect);

// /search BEFORE /:id to prevent "search" being treated as a chat ID
router.get("/search", searchLimiter, searchChatsHandler);

router.post(  "/",             writeLimiter, createChatHandler);
router.get(   "/",                           listChatsHandler);
router.get(   "/:id",                        loadChatHandler);
router.post(  "/:id/messages", writeLimiter, saveMessageHandler);
router.patch( "/:id/rename",   writeLimiter, renameChatHandler);
router.patch( "/:id/archive",  writeLimiter, archiveChatHandler);
router.delete("/:id",          writeLimiter, deleteChatHandler);

export default router;
