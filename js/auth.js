const db = window.db;

const tabButtons = document.querySelectorAll(".tab-btn");
const forms = document.querySelectorAll(".auth-form");
const authMessage = document.getElementById("authMessage");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

function showMessage(text, type = "error") {
  authMessage.textContent = text;
  authMessage.className = type === "success" ? "auth-message success" : "auth-message";
}

function setButtonLoading(form, isLoading, loadingText = "Подождите...") {
  const button = form.querySelector('button[type="submit"]');

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function cleanText(value) {
  return value.trim();
}

function cleanEmail(value) {
  return value.trim().toLowerCase();
}

function cleanRestaurantId(value) {
  return value.trim();
}

function goToPlanning() {
  window.location.href = "pages/planning.html";
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.target;

    tabButtons.forEach((btn) => btn.classList.remove("active"));
    forms.forEach((form) => form.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(targetId).classList.add("active");

    showMessage("");
  });
});

const togglePasswordButtons = document.querySelectorAll(".toggle-password");

togglePasswordButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const inputId = button.dataset.target;
    const input = document.getElementById(inputId);

    if (!input) return;

    const isHidden = input.type === "password";

    input.type = isHidden ? "text" : "password";
    button.classList.toggle("is-visible", isHidden);

    button.setAttribute(
      "aria-label",
      isHidden ? "Скрыть пароль" : "Показать пароль"
    );
  });
});

async function checkExistingSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  if (data.session) {
    goToPlanning();
  }
}

checkExistingSession();

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  const restaurantName = cleanText(document.getElementById("restaurantName").value);
  const email = cleanEmail(document.getElementById("registerEmail").value);
  const restaurantId = cleanRestaurantId(document.getElementById("restaurantId").value);
  const password = document.getElementById("registerPassword").value;

  if (!restaurantName || !email || !restaurantId || !password) {
    showMessage("Заполните все поля.");
    return;
  }

  if (password.length < 6) {
    showMessage("Пароль должен быть минимум 6 символов.");
    return;
  }

  setButtonLoading(registerForm, true, "Регистрация...");

  try {
    const { data: signUpData, error: signUpError } = await db.auth.signUp({
      email,
      password
    });

    if (signUpError) throw signUpError;

    let user = signUpData.user;

    const { data: sessionData } = await db.auth.getSession();

    if (!sessionData.session) {
      const { error: signInError } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;
    }

    if (!user) {
      const { data: userData, error: userError } = await db.auth.getUser();

      if (userError) throw userError;

      user = userData.user;
    }

    if (!user) {
      throw new Error("Пользователь не найден. Попробуйте войти заново.");
    }

    const { error: restaurantError } = await db
      .from("restaurants")
      .upsert(
        {
          restaurant_id: restaurantId,
          name: restaurantName,
          created_by: user.id
        },
        {
          onConflict: "restaurant_id",
          ignoreDuplicates: true
        }
      );

    if (restaurantError) throw restaurantError;

    const { error: profileError } = await db
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          email: email,
          restaurant_id: restaurantId
        },
        {
          onConflict: "user_id"
        }
      );

    if (profileError) throw profileError;

    showMessage("Регистрация успешно завершена!", "success");

    setTimeout(() => {
      goToPlanning();
    }, 600);
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Ошибка при регистрации.");
  } finally {
    setButtonLoading(registerForm, false);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  const email = cleanEmail(document.getElementById("loginEmail").value);
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    showMessage("Введите email и пароль.");
    return;
  }

  setButtonLoading(loginForm, true, "Вход...");

  try {
    const { error: loginError } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) throw loginError;

    const { data: userData, error: userError } = await db.auth.getUser();

    if (userError) throw userError;

    const user = userData.user;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error("Профиль не найден. Проверьте регистрацию.");
    }

    goToPlanning();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Ошибка при входе.");
  } finally {
    setButtonLoading(loginForm, false);
  }
});