import express from "express";
import rateLimit from "express-rate-limit";
import { sendConsultationMessage, getConsultationState } from "../controllers/consultationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many messages. Please slow down.", code: "MESSAGE_RATE_LIMITED" },
});

router.use(protect);

router.post("/:chatId/message", messageLimiter,  sendConsultationMessage);
router.get("/:chatId/state", getConsultationState);

export default router;
