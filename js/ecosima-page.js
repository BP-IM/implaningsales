(function () {
  const BUCKET = "ecosima-files";
  const TABLE = "ecosima_files";
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  let allFiles = [];
  let currentEditFileId = null;

  function getDb() {
    const db = window.db;

    if (!db || !db.from || !db.storage || !db.auth) {
      throw new Error("Клиент Supabase не найден. Проверьте window.db.");
    }

    return db;
  }

  function getRestaurantIdFromLocalStorage() {
    return (
      localStorage.getItem("restaurant_id") ||
      localStorage.getItem("restaurantId") ||
      localStorage.getItem("currentRestaurantId")
    );
  }

  function getExt(fileName) {
    const parts = String(fileName || "").split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }

  function slugifyFileName(name) {
    const ext = getExt(name);
    const randomPart =
      window.crypto?.randomUUID?.() ||
      Math.random().toString(36).slice(2);

    return ext
      ? `file-${Date.now()}-${randomPart}.${ext}`
      : `file-${Date.now()}-${randomPart}`;
  }

  function formatBytes(bytes) {
    if (bytes === null || bytes === undefined) return "";

    const sizes = ["B", "KB", "MB", "GB"];
    let value = Number(bytes);
    let index = 0;

    while (value >= 1024 && index < sizes.length - 1) {
      value = value / 1024;
      index++;
    }

    return `${value.toFixed(index === 0 ? 0 : 1)} ${sizes[index]}`;
  }

  function formatDate(value) {
    if (!value) return "";

    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, type) {
    const status = document.getElementById("ecosimaStatus");
    if (!status) return;

    status.textContent = message || "";
    status.className = "ecosima-status";

    if (type) {
      status.classList.add(type);
    }
  }

  function setEditStatus(message, type) {
    const status = document.getElementById("ecosimaEditStatus");
    if (!status) return;

    status.textContent = message || "";
    status.className = "ecosima-status";

    if (type) {
      status.classList.add(type);
    }
  }

  function getFileLabel(file) {
    const mime = file.mime_type || "";
    const ext = file.file_ext || "";

    if (mime.startsWith("image/")) return "Фото";
    if (mime === "application/pdf" || ext === "pdf") return "PDF";
    if (["doc", "docx"].includes(ext)) return "Word";
    if (["xls", "xlsx"].includes(ext)) return "Excel";

    return "Файл";
  }

  function getPreviewLabel(file) {
    const mime = file.mime_type || "";
    const ext = file.file_ext || "";

    if (mime.startsWith("image/")) return "IMG";
    if (mime === "application/pdf" || ext === "pdf") return "PDF";
    if (["doc", "docx"].includes(ext)) return "DOC";
    if (["xls", "xlsx"].includes(ext)) return "XLS";

    return "FILE";
  }

  async function getCurrentUser() {
    const db = getDb();

    const { data, error } = await db.auth.getUser();

    if (error) throw error;

    if (!data?.user) {
      throw new Error("Пользователь не авторизован.");
    }

    return data.user;
  }

  async function getRestaurantId() {
    const db = getDb();
    const localRestaurantId = getRestaurantIdFromLocalStorage();

    if (localRestaurantId) {
      return String(localRestaurantId);
    }

    const user = await getCurrentUser();

    const { data: profile, error } = await db
      .from("profiles")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!profile?.restaurant_id) {
      throw new Error("Не удалось определить ID ресторана.");
    }

    localStorage.setItem("restaurant_id", profile.restaurant_id);

    return String(profile.restaurant_id);
  }

  async function getSignedUrl(filePath) {
    const db = getDb();

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60);

    if (error) throw error;

    return data.signedUrl;
  }

  async function loadFiles() {
    const db = getDb();
    const restaurantId = await getRestaurantId();

    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const files = data || [];

    allFiles = await Promise.all(
      files.map(async (file) => {
        const isImage = String(file.mime_type || "").startsWith("image/");

        if (!isImage) {
          return file;
        }

        try {
          const signedUrl = await getSignedUrl(file.file_path);

          return {
            ...file,
            signedUrl
          };
        } catch (error) {
          console.error(error);
          return file;
        }
      })
    );

    renderFiles();
  }

  function renderFiles() {
    const list = document.getElementById("ecosimaFilesList");
    const searchInput = document.getElementById("ecosimaSearch");
    const filterSelect = document.getElementById("ecosimaFilter");

    if (!list) return;

    const search = (searchInput?.value || "").toLowerCase().trim();
    const filter = filterSelect?.value || "all";

    const filteredFiles = allFiles.filter((file) => {
      const text = [
        file.title,
        file.description,
        file.file_name,
        file.category,
        file.file_ext,
        getFileLabel(file)
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || text.includes(search);
      const matchesFilter = filter === "all" || file.category === filter;

      return matchesSearch && matchesFilter;
    });

    if (!filteredFiles.length) {
      list.innerHTML = `
        <div class="ecosima-empty">
          Файлы пока не загружены.
        </div>
      `;
      return;
    }

    list.innerHTML = filteredFiles
      .map((file) => {
        const title = file.title || file.file_name;
        const description = file.description || "";
        const previewLabel = getPreviewLabel(file);
        const fileLabel = getFileLabel(file);

        const previewHtml = file.signedUrl
          ? `<img src="${file.signedUrl}" alt="${escapeHtml(title)}" />`
          : `<span>${escapeHtml(previewLabel)}</span>`;

        return `
          <article class="ecosima-file-card">
            <div class="ecosima-file-preview">
              ${previewHtml}
            </div>

            <div>
              <div class="ecosima-file-title">
                ${escapeHtml(title)}
              </div>

              <div class="ecosima-file-meta">
                ${escapeHtml(file.category || "Другое")} · ${escapeHtml(fileLabel)} · ${formatBytes(file.file_size)}
                <br />
                ${formatDate(file.created_at)}
                <br />
                ${escapeHtml(file.file_name)}
              </div>
            </div>

            ${
              description
                ? `<div class="ecosima-file-desc">${escapeHtml(description)}</div>`
                : ""
            }

            <div class="ecosima-file-actions">
              <button class="ecosima-open-btn" type="button" data-open-id="${file.id}">
                Открыть
              </button>

              <button class="ecosima-edit-btn" type="button" data-edit-id="${file.id}">
                Редактировать
              </button>

              <button class="ecosima-delete-btn" type="button" data-delete-id="${file.id}">
                Удалить
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function clearUploadSelectedFile() {
    const fileInput = document.getElementById("ecosimaFileInput");
    const selectedFile = document.getElementById("ecosimaSelectedFile");

    if (fileInput) fileInput.value = "";
    if (selectedFile) selectedFile.textContent = "Файл не выбран";
  }

  function clearEditSelectedFile() {
    const fileInput = document.getElementById("ecosimaEditFileInput");
    const selectedFile = document.getElementById("ecosimaEditSelectedFile");

    if (fileInput) fileInput.value = "";
    if (selectedFile) selectedFile.textContent = "Новый файл не выбран";
  }

  async function uploadFile() {
    const db = getDb();

    const titleInput = document.getElementById("ecosimaTitle");
    const categoryInput = document.getElementById("ecosimaCategory");
    const descriptionInput = document.getElementById("ecosimaDescription");
    const fileInput = document.getElementById("ecosimaFileInput");
    const uploadBtn = document.getElementById("ecosimaUploadBtn");

    const file = fileInput?.files?.[0];

    if (!file) {
      setStatus("Выберите файл для загрузки.", "error");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("Размер файла не должен превышать 50 MB.", "error");
      return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "Загрузка...";
    setStatus("Файл загружается...", "");

    try {
      const user = await getCurrentUser();
      const restaurantId = await getRestaurantId();

      const safeName = slugifyFileName(file.name);
      const ext = getExt(file.name);
      const filePath = `${restaurantId}/${safeName}`;

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream"
        });

      if (uploadError) throw uploadError;

      const payload = {
        restaurant_id: restaurantId,
        title: titleInput?.value?.trim() || file.name,
        description: descriptionInput?.value?.trim() || null,
        category: categoryInput?.value || "Другое",
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        file_ext: ext,
        uploaded_by: user.id
      };

      const { error: insertError } = await db
        .from(TABLE)
        .insert(payload);

      if (insertError) throw insertError;

      if (titleInput) titleInput.value = "";
      if (descriptionInput) descriptionInput.value = "";
      clearUploadSelectedFile();

      setStatus("Файл успешно загружен.", "ok");

      await loadFiles();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Ошибка при загрузке файла.", "error");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Загрузить";
    }
  }

  async function openFile(fileId) {
    const file = allFiles.find((item) => item.id === fileId);

    if (!file) return;

    try {
      const signedUrl = await getSignedUrl(file.file_path);
      window.open(signedUrl, "_blank");
    } catch (error) {
      console.error(error);
      setStatus("Не удалось открыть файл.", "error");
    }
  }

  function openEditModal(fileId) {
    const file = allFiles.find((item) => item.id === fileId);
    if (!file) return;

    currentEditFileId = file.id;

    const modal = document.getElementById("ecosimaEditModal");
    const fileName = document.getElementById("ecosimaEditFileName");
    const titleInput = document.getElementById("ecosimaEditTitle");
    const categoryInput = document.getElementById("ecosimaEditCategory");
    const descriptionInput = document.getElementById("ecosimaEditDescription");

    if (fileName) fileName.textContent = file.file_name || "Файл";
    if (titleInput) titleInput.value = file.title || "";
    if (categoryInput) categoryInput.value = file.category || "Другое";
    if (descriptionInput) descriptionInput.value = file.description || "";

    clearEditSelectedFile();
    setEditStatus("", "");

    modal?.classList.add("show");
  }

  function closeEditModal() {
    const modal = document.getElementById("ecosimaEditModal");

    currentEditFileId = null;
    modal?.classList.remove("show");

    clearEditSelectedFile();
    setEditStatus("", "");
  }

  async function saveEditedFile() {
    if (!currentEditFileId) return;

    const db = getDb();

    const currentFile = allFiles.find((item) => item.id === currentEditFileId);
    if (!currentFile) return;

    const titleInput = document.getElementById("ecosimaEditTitle");
    const categoryInput = document.getElementById("ecosimaEditCategory");
    const descriptionInput = document.getElementById("ecosimaEditDescription");
    const editFileInput = document.getElementById("ecosimaEditFileInput");
    const saveBtn = document.getElementById("ecosimaSaveEditBtn");

    const title = titleInput?.value?.trim();
    const category = categoryInput?.value || "Другое";
    const description = descriptionInput?.value?.trim() || null;
    const newFile = editFileInput?.files?.[0] || null;

    if (!title) {
      setEditStatus("Введите название файла.", "error");
      return;
    }

    if (newFile && newFile.size > MAX_FILE_SIZE) {
      setEditStatus("Размер нового файла не должен превышать 50 MB.", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Сохранение...";
    setEditStatus("Сохранение изменений...", "");

    let newFilePath = null;

    try {
      const updatePayload = {
        title,
        category,
        description
      };

      if (newFile) {
        const restaurantId = await getRestaurantId();
        const safeName = slugifyFileName(newFile.name);
        const ext = getExt(newFile.name);

        newFilePath = `${restaurantId}/${safeName}`;

        const { error: uploadError } = await db.storage
          .from(BUCKET)
          .upload(newFilePath, newFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: newFile.type || "application/octet-stream"
          });

        if (uploadError) throw uploadError;

        updatePayload.file_name = newFile.name;
        updatePayload.file_path = newFilePath;
        updatePayload.mime_type = newFile.type || "application/octet-stream";
        updatePayload.file_size = newFile.size;
        updatePayload.file_ext = ext;
      }

      const { error: updateError } = await db
        .from(TABLE)
        .update(updatePayload)
        .eq("id", currentEditFileId);

      if (updateError) {
        if (newFilePath) {
          await db.storage.from(BUCKET).remove([newFilePath]);
        }

        throw updateError;
      }

      if (newFilePath && currentFile.file_path && currentFile.file_path !== newFilePath) {
        const { error: removeOldError } = await db.storage
          .from(BUCKET)
          .remove([currentFile.file_path]);

        if (removeOldError) {
          console.warn("Старый файл не удалился:", removeOldError);
        }
      }

      setEditStatus("Изменения сохранены.", "ok");

      await loadFiles();

      setTimeout(() => {
        closeEditModal();
      }, 400);
    } catch (error) {
      console.error(error);
      setEditStatus(error.message || "Ошибка при сохранении изменений.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить";
    }
  }

  async function deleteFile(fileId) {
    const db = getDb();
    const file = allFiles.find((item) => item.id === fileId);

    if (!file) return;

    const isConfirmed = confirm(`Удалить файл "${file.title || file.file_name}"?`);

    if (!isConfirmed) return;

    try {
      setStatus("Файл удаляется...", "");

      const { error: storageError } = await db.storage
        .from(BUCKET)
        .remove([file.file_path]);

      if (storageError) throw storageError;

      const { error: deleteError } = await db
        .from(TABLE)
        .delete()
        .eq("id", file.id);

      if (deleteError) throw deleteError;

      setStatus("Файл удален.", "ok");

      await loadFiles();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Ошибка при удалении файла.", "error");
    }
  }

  function bindEvents() {
    const uploadBtn = document.getElementById("ecosimaUploadBtn");
    const refreshBtn = document.getElementById("ecosimaRefreshBtn");
    const fileInput = document.getElementById("ecosimaFileInput");
    const clearSelectedFileBtn = document.getElementById("ecosimaClearSelectedFileBtn");
    const selectedFile = document.getElementById("ecosimaSelectedFile");
    const searchInput = document.getElementById("ecosimaSearch");
    const filterSelect = document.getElementById("ecosimaFilter");
    const list = document.getElementById("ecosimaFilesList");

    const saveEditBtn = document.getElementById("ecosimaSaveEditBtn");
    const editFileInput = document.getElementById("ecosimaEditFileInput");
    const editSelectedFile = document.getElementById("ecosimaEditSelectedFile");
    const editClearFileBtn = document.getElementById("ecosimaEditClearFileBtn");
    const closeEditButtons = document.querySelectorAll("[data-close-edit-modal]");

    uploadBtn?.addEventListener("click", uploadFile);

    clearSelectedFileBtn?.addEventListener("click", () => {
      clearUploadSelectedFile();
      setStatus("", "");
    });

    refreshBtn?.addEventListener("click", async () => {
      try {
        setStatus("Обновление списка файлов...", "");
        await loadFiles();
        setStatus("", "");
      } catch (error) {
        console.error(error);
        setStatus(error.message || "Ошибка при обновлении списка файлов.", "error");
      }
    });

    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];

      if (!selectedFile) return;

      selectedFile.textContent = file
        ? `${file.name} · ${formatBytes(file.size)}`
        : "Файл не выбран";
    });

    searchInput?.addEventListener("input", renderFiles);
    filterSelect?.addEventListener("change", renderFiles);

    saveEditBtn?.addEventListener("click", saveEditedFile);

    editFileInput?.addEventListener("change", () => {
      const file = editFileInput.files?.[0];

      if (!editSelectedFile) return;

      editSelectedFile.textContent = file
        ? `${file.name} · ${formatBytes(file.size)}`
        : "Новый файл не выбран";
    });

    editClearFileBtn?.addEventListener("click", () => {
      clearEditSelectedFile();
      setEditStatus("", "");
    });

    closeEditButtons.forEach((button) => {
      button.addEventListener("click", closeEditModal);
    });

    list?.addEventListener("click", (event) => {
      const openBtn = event.target.closest("[data-open-id]");
      const editBtn = event.target.closest("[data-edit-id]");
      const deleteBtn = event.target.closest("[data-delete-id]");

      if (openBtn) {
        openFile(openBtn.dataset.openId);
      }

      if (editBtn) {
        openEditModal(editBtn.dataset.editId);
      }

      if (deleteBtn) {
        deleteFile(deleteBtn.dataset.deleteId);
      }
    });
  }

  window.initEcosimaPage = async function initEcosimaPage() {
    if (!document.querySelector(".ecosima-page")) return;

    bindEvents();

    try {
      setStatus("Загрузка списка файлов...", "");
      await loadFiles();
      setStatus("", "");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Не удалось загрузить раздел Экосима.", "error");
    }
  };
})();