import api from "./axiosInstance.js";

export const chatApi = {
  create:      (categoryId = null) =>
    api.post("/chats", { categoryId }).then((r) => r.data),

  list:        (params = {}) =>
    api.get("/chats", { params }).then((r) => r.data),

  search:      (query) =>
    api.get("/chats/search", { params: { q: query } }).then((r) => r.data),

  load:        (chatId) =>
    api.get(`/chats/${chatId}`).then((r) => r.data),

  saveMessage: (chatId, messageData) =>
    api.post(`/chats/${chatId}/messages`, messageData).then((r) => r.data),

  rename:      (chatId, title) =>
    api.patch(`/chats/${chatId}/rename`, { title }).then((r) => r.data),

  archive:     (chatId, archive = true) =>
    api.patch(`/chats/${chatId}/archive`, { archive }).then((r) => r.data),

  delete:      (chatId) =>
    api.delete(`/chats/${chatId}`).then((r) => r.data),
};

export default chatApi;
