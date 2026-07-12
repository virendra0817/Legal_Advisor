import {
  createChat,
  saveMessage,
  loadChat,
  listChats,
  searchChats,
  renameChat,
  deleteChat,
  archiveChat,
  ChatHistoryError,
} from "../services/chatHistoryService.js";

const sendSuccess = (res, statusCode, message, data = {}) =>
  res.status(statusCode).json({ success: true, message, ...data });

const sendError = (res, statusCode, message, code, extra = {}) =>
  res.status(statusCode).json({ success: false, message, code, ...extra });

const ERROR_STATUS = {
  CHAT_NOT_FOUND: 404,
  EMPTY_QUERY:    400,
  EMPTY_TITLE:    400,
  TITLE_TOO_LONG: 400,
};

const statusFor = (code) => ERROR_STATUS[code] || 500;

const handleServiceError = (res, error, fallbackMessage) => {
  if (error instanceof ChatHistoryError) {
    return sendError(res, statusFor(error.code), error.message, error.code);
  }
  if (error.name === "CastError") {
    return sendError(res, 400, "Invalid ID format.", "INVALID_ID");
  }
  console.error(fallbackMessage, error);
  return sendError(res, 500, fallbackMessage, "INTERNAL_ERROR");
};

export const createChatHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { categoryId } = req.body;
    const chat = await createChat(userId, { categoryId });
    return sendSuccess(res, 201, "Chat created.", { chat });
  } catch (error) {
    return handleServiceError(res, error, "Failed to create chat.");
  }
};

export const listChatsHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(50, parseInt(req.query.limit) || 20);
    const status  = ["active", "archived"].includes(req.query.status)
      ? req.query.status : "active";
    const { categoryId } = req.query;
    const result = await listChats(userId, { page, limit, status, categoryId: categoryId || null });
    return sendSuccess(res, 200, "Chats fetched.", result);
  } catch (error) {
    return handleServiceError(res, error, "Failed to list chats.");
  }
};

export const searchChatsHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return sendError(res, 400, "Search query (q) is required.", "MISSING_QUERY");
    }
    const chats = await searchChats(userId, q);
    return sendSuccess(res, 200, "Search results fetched.", { chats, query: q });
  } catch (error) {
    return handleServiceError(res, error, "Search failed.");
  }
};

export const loadChatHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { chat, messages } = await loadChat(id, userId);
    return sendSuccess(res, 200, "Chat loaded.", { chat, messages });
  } catch (error) {
    return handleServiceError(res, error, "Failed to load chat.");
  }
};

export const saveMessageHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id: chatId } = req.params;
    const { role, content, contentType, citations, documentRefs,
            consultationPhase, tokenUsage, isStreamed } = req.body;
    if (!role || !content) {
      return sendError(res, 400, "role and content are required.", "MISSING_FIELDS");
    }
    if (!["user", "assistant", "system"].includes(role)) {
      return sendError(res, 400, "Invalid role.", "INVALID_ROLE");
    }
    const message = await saveMessage(chatId, userId, {
      role, content, contentType, citations,
      documentRefs, consultationPhase, tokenUsage, isStreamed,
    });
    return sendSuccess(res, 201, "Message saved.", { message });
  } catch (error) {
    return handleServiceError(res, error, "Failed to save message.");
  }
};

export const renameChatHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { title } = req.body;
    if (!title) return sendError(res, 400, "title is required.", "MISSING_TITLE");
    const chat = await renameChat(id, userId, title);
    return sendSuccess(res, 200, "Chat renamed.", { chat });
  } catch (error) {
    return handleServiceError(res, error, "Failed to rename chat.");
  }
};

export const archiveChatHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const archive = req.body.archive !== false;
    const chat = await archiveChat(id, userId, archive);
    return sendSuccess(res, 200, archive ? "Chat archived." : "Chat restored.", { chat });
  } catch (error) {
    return handleServiceError(res, error, "Failed to archive chat.");
  }
};

export const deleteChatHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    await deleteChat(id, userId);
    return sendSuccess(res, 200, "Chat deleted.");
  } catch (error) {
    return handleServiceError(res, error, "Failed to delete chat.");
  }
};
