const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();
const { UserModel } = require("./database");
const { ChatModel } = require("./database");
const CronJob = require("cron").CronJob;
const i18n = require("i18n");

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });
function is_dev(user_id) {
    const devUsers = process.env.DEV_USERS.split(",");
    return devUsers.includes(user_id.toString());
}

i18n.configure({
    locales: ["en", "pt", "ru", "es", "fr", "hi", "it", "tr", "uk"],
    directory: __dirname + "/locales",
    defaultLocale: "en",
    queryParameter: "lang",
    cookie: "language",
    indent: "  ",
});

const languageToTimezone = {
    en: "America/New_York",
    pt: "America/Sao_Paulo",
    ru: "Europe/Moscow",
    es: "Europe/Madrid",
    fr: "Europe/Paris",
    hi: "Asia/Kolkata",
    it: "Europe/Rome",
    tr: "Europe/Istanbul",
    uk: "Europe/Kiev"
};

const weatherBaseUrl = "https://api.openweathermap.org/data/2.5/weather";

async function getUserLanguage(userId) {
    try {
        const user = await UserModel.findOne({ userID: userId });
        if (user) {
            return user.lang;
        } else {
            return i18n.defaultLocale;
        }
    } catch (error) {
        console.error("Error fetching user language:", error);
        return i18n.defaultLocale;
    }
}

const chatCommands = [
    {
        command: 'start', description: i18n.__({ phrase: "start_cmmd", locale: getUserLanguage })
    },
    {
        command: 'help', description: i18n.__({ phrase: "help_cmmd", locale: getUserLanguage })
    },

];

bot.setMyCommands(chatCommands, { scope: JSON.stringify({ type: 'all_private_chats', language_code: getUserLanguage }) })


bot.on("inline_query", async (query) => {
    const userId = query.from.id;
    const userLanguage = await getUserLanguage(userId) || "en";
    const cityName = query.query;
    const timezone = languageToTimezone[userLanguage] || "America/New_York";


    if (!cityName) {
        const result_init = {
            type: 'article',
            id: query.id,
            title: i18n.__({ phrase: "title_init", locale: userLanguage }),
            description: i18n.__({ phrase: "description_init", locale: userLanguage }),
            input_message_content: {
                message_text: i18n.__({ phrase: "msg_text_init", locale: userLanguage }),
                parse_mode: 'HTML',
            },
            thumbnail_url: 'https://i.postimg.cc/W3r4XDRb/Te-N24-Assets-de-bot-Te-N-Weather-0002-Asset-Pesquisar.png',
        }
        await bot.answerInlineQuery(query.id, [result_init], {
            switch_pm_text: i18n.__({ phrase: "how_to_use", locale: userLanguage }),
            switch_pm_parameter: "how_to_use",
            cache_time: 0,
        });

        return;
    }

    let units = "metric";
    let lang = userLanguage;

    i18n.setLocale(lang);

    try {
        const response = await axios.get(
            `${weatherBaseUrl}?q=${cityName}&appid=${process.env.WEATHER_API_KEY}&units=${units}&lang=${lang}`
        );

        const formattedCityName = toTitleCase(cityName);
        const weatherData = response.data;
        const temperature = Math.round(weatherData.main.temp);
        const weatherDescription = weatherData.weather[0].description;
        const weatherIconCode = weatherData.weather[0].icon;
        const feelsLike = Math.round(weatherData.main.feels_like);
        const tempmax = Math.round(weatherData.main.temp_max);
        const tempmin = Math.round(weatherData.main.temp_min);
        const windSpeed = Math.round(weatherData.wind.speed);
        const humidity = weatherData.main.humidity;
        const moonrise = weatherData.moonrise;
        const emoji = getWeatherEmoji(weatherIconCode);
        const countryCode = weatherData.sys.country || "";
        const agora = new Date();
        const opcoes = { timeZone: timezone };
        const horarioFormatado = agora.toLocaleTimeString("pt-BR", opcoes);
        const dataFormatada = agora.toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        const FormatedDate = agora.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        const FormatedDateES = agora.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

        const weatherIconUrl = `http://openweathermap.org/img/wn/${weatherIconCode}.png`;

        const firstAlert = weatherData.alerts ? weatherData.alerts[0] : null;

        let alertMessage;
        if (firstAlert) {
            const alertEvent = firstAlert.event;
            const alertDescription = firstAlert.description;
            const alertTags = firstAlert.tags.join(", ");

            alertMessage = i18n.__("alert_message", {
                alertEvent,
                alertDescription,
                alertTags,
            });
        } else {
            alertMessage = i18n.__("no_alert_message");
        }

        const message = i18n.__("weather_forecast_message", {
            formattedCityName,
            cityName,
            emoji,
            temperature,
            weatherDescription: weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1).toLowerCase(),
            feelsLike,
            tempmax,
            tempmin,
            countryCode,
            horarioFormatado,
            dataFormatada,
            alertMessage,
            FormatedDate,
            FormatedDateES,
        });
        const message1 = i18n.__("city_weather_forecast_message", {
            formattedCityName,
            cityName,
            emoji,
            temperature,
            weatherDescription: weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1).toLowerCase(),
            feelsLike,
            tempmax,
            tempmin,
            windSpeed,
            humidity,
            countryCode,
            horarioFormatado,
            dataFormatada,
            alertMessage,
            FormatedDate,
            FormatedDateES,
            alertMessage,
        });
        const title_message_visible = i18n.__("title_message_visible");
        const description_visible = i18n.__("description_visible", {
            cityName: formattedCityName,
            countryCode,
        });
        const title_message_hidden = i18n.__("title_message_hidden");
        const description_hidden = i18n.__("description_hidden", {
            cityName: formattedCityName,
            countryCode,
        });

        const result = [
            {
                type: "article",
                id: "1",
                title: title_message_hidden,
                description: description_hidden,
                input_message_content: {
                    message_text: message,
                    parse_mode: "markdown",
                },
                thumb_url: "https://i.postimg.cc/jdsmrCQT/Te-N24-Assets-de-bot-Te-N-Weather-0001-Ativo-39.png",
            },
            {
                type: "article",
                id: "2",
                title: title_message_visible,
                description: description_visible,
                input_message_content: {
                    message_text: message1,
                    parse_mode: "markdown",
                },
                thumbnail_url: "https://i.postimg.cc/XNKmh95x/Te-N24-Assets-de-bot-Te-N-Weather-0000-Ativo-40.png",
            },
        ];

        bot.answerInlineQuery(query.id, result);
        console.log(result);
    } catch (error) {
        console.log(error);

        const errorMessage = i18n.__("erro_message");
        const errorResult = [
            {
                type: "article",
                id: "3",
                title: i18n.__("title_error"),
                description: i18n.__("description_error"),
                input_message_content: {
                    message_text: errorMessage,
                },
                thumbnail_url:
                    "https://i.postimg.cc/Fz4Hq9mb/Te-N24-Assets-de-bot-Te-N-Weather-0003-Asset-Erro.png",
            },
        ];

        bot.answerInlineQuery(query.id, errorResult);
    }
});

function getTemperatureEmoji(temperature) {
    if (temperature < -10) {
        return "❄️";
    } else if (temperature < 0) {
        return "🥶";
    } else if (temperature < 10) {
        return "🧊";
    } else if (temperature < 20) {
        return "🌡️";
    } else if (temperature < 25) {
        return "🌤️";
    } else if (temperature < 30) {
        return "☀️";
    } else if (temperature < 35) {
        return "🔥";
    } else {
        return "🥵";
    }
}

function getWeatherEmoji(iconCode) {
    const emojiMap = {
      "01d": "☀️",
      "01n": "🌙",
      "02d": "⛅️",
      "02n": "☁️",
      "03d": "☁️",
      "03n": "☁️",
      "04d": "☁️",
      "04n": "☁️",
      "09d": "🌦️",
      "09n": "🌧️",
      "10d": "🌧️",
      "10n": "🌧️",
      "11d": "🌩️",
      "11n": "🌩️",
      "13d": "❄️",
      "13n": "❄️",
      "50d": "🌫️",
      "50n": "🌫️",
    };
  
    return emojiMap[iconCode] || "❓";
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(word, index) {
      // Verifica se a palavra não é "de", "da" ou "do"
      if (["de", "da", "do", "del", "y", "of"].includes(word.toLowerCase()) && index > 0) {
        return word.toLowerCase(); // Mantém as palavras "de", "da" e "do" em minúsculas
      } else {
        return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
      }
    });
  }

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments();
    const message = `\n<b>Estatísticas do bot</b>\n\n• Total de <b>${numUsers} usuários</b> usam este bot;\n• Ele está presente em <b>${numChats} chats</b>.`;
    bot.sendMessage(chatId, message, { parse_mode: "HTML"});
});

const groupId = process.env.groupId;

UserModel.on("save", (user) => {
    const message = `#Novo_Usuário
<b>Nome:</b> <a href="tg://user?id=${user.userID}">${user.firstName}</a>
<b>ID:</b> <code>${user.userID}</code>
<b>Nome de usuário:</b> ${user.username ? `@${user.username}` : "Não informado"}`;
    bot.sendMessage(groupId, message, { parse_mode: "HTML" });
});


bot.onText(/\/start/, async (msg) => {
    if (msg.chat.type !== "private") {
        return;
    }

    const chatId = msg.chat.id;

    let user = await UserModel.findOne({ userID: msg.from.id });
    if (!user) {
        user = new UserModel({
            firstName: msg.from.first_name,
            userID: msg.from.id,
            username: msg.from.username,
            lang: "en",
        });
        await user.save();
    } else {
        i18n.setLocale(user.lang);
    }

    bot.sendMessage(chatId, i18n.__("startMessage"), {
        parse_mode: "markdown",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: i18n.__("inline_psq"),
                        switch_inline_query_current_chat: '',
                    },
                ],
                [
                    {
                        text: i18n.__("addGroup"),
                        url: "https://t.me/tenclima_bot?startgroup=true",
                    }
                  
                ],
                [
                    {
                        text: i18n.__("help"),
                        callback_data: "help",
                    },
                    {
                        text: i18n.__("langMessage"),
                        callback_data: "choose_language",
                    },
                    
                ],
            ],
        },
    });
});

bot.on("callback_query", async (callbackQuery) => {
    if (callbackQuery.message.chat.type !== "private") {
        return;
    }

    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    if (callbackQuery.data === "help") {
        await bot.editMessageText(i18n.__("help_message"), {
            parse_mode: "markdown",
            disable_web_page_preview: true,
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("inline_psq"),
                            switch_inline_query_current_chat: '',
                        },
                    ],
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    }

    if (callbackQuery.data === "choose_language") {
        await bot.editMessageText(i18n.__("chooseLangMessage"), {
            parse_mode: "markdown",
            disable_web_page_preview: true,
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🇧🇷 Português",
                            callback_data: "choose_portuguese",
                        },
                        {
                            text: "🇺🇸 English",
                            callback_data: "choose_english",
                        },
                        {
                            text: "🇪🇸 Español",
                            callback_data: "choose_spanish",
                        },
                    ],
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_portuguese") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "pt" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_english") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "en" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_russian") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "ru" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_spanish") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "es" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_french") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "fr" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_hindi") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "hi" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_italian") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "it" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_turkish") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "tr" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "choose_ukrainian") {
        const user = await UserModel.findOneAndUpdate(
            { userID: callbackQuery.from.id },
            { lang: "uk" },
            { new: true }
        );
        i18n.setLocale(user.lang);

        await bot.editMessageText(i18n.__("langChangedMessage"), {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("back"),
                            callback_data: "back_to_start",
                        },
                    ],
                ],
            },
        });
    } else if (callbackQuery.data === "back_to_start") {
        await bot.editMessageText(i18n.__("startMessage"), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "markdown",
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("inline_psq"),
                            switch_inline_query_current_chat: '',
                        },
                    ],
                    [
                        {
                            text: i18n.__("addGroup"),
                            url: "https://t.me/tenclima_bot?startgroup=true",
                        }
                    ],
                    [
                        {
                            text: i18n.__("help"),
                            callback_data: "help",
                        },
                        {
                            text: i18n.__("langMessage"),
                            callback_data: "choose_language",
                        },
                    ],
                ],
            },
        });
    }
});

bot.onText(/\/lang/, (msg) => {
    const chatId = msg.chat.id;

    if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
        bot.sendMessage(chatId, i18n.__("pv_message_lang"), {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: i18n.__("pv_message_lang_button"),
                            url: "https://t.me/tenclima_bot?start=lang",
                        },
                    ],
                ],
            },
        });
        return;
    }

    bot.sendMessage(chatId, i18n.__("chooseLanguage"), {
        parse_mode: "markdown",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "🇧🇷 Português",
                        callback_data: "choose_portuguese",
                    },
                    {
                        text: "🇺🇸 English",
                        callback_data: "choose_english",
                    },
                    {
                        text: "🇪🇸 Español",
                        callback_data: "choose_spanish",
                    },
                ],
                [
                    {
                        text: i18n.__("startlanguptdate"),
                        callback_data: "back_to_start",
                    },
                ],
            ],
        },
    });
});

bot.onText(/\/help/, (msg) => {
    if (msg.chat.type !== "private") {
        return;
    }
    const chatId = msg.chat.id;

    const helpMessage = i18n.__("help_message");

    bot.sendPhoto(
        chatId,
        "https://i.postimg.cc/C1xS1Jbh/Imagem-de-descri-o.jpg",
        {
            caption: helpMessage,
            parse_mode: "markdown",
            disable_web_page_preview: true,
            reply_markup: {
            },
        }
    );
});

bot.on("new_chat_members", async (msg) => {
    const chatId = msg.chat.id;
    const chatName = msg.chat.title;

    try {
        const chat = await ChatModel.findOne({ chatId: chatId });

        if (chat) {
            console.log(
                `Grupo ${chatName} (${chatId}) já existe no banco de dados.`
            );
        } else {
            const newChat = await ChatModel.create({ chatId, chatName });
            console.log(
                `Grupo ${newChat.chatName} (${newChat.chatId}) adicionado ao banco de dados.`
            );

            const botUser = await bot.getMe();
            const newMembers = msg.new_chat_members.filter(
                (member) => member.id === botUser.id
            );
            if (msg.chat.username) {
                chatusername = `@${msg.chat.username}`;
            } else {
                chatusername = "Private Group";
            }

            if (newMembers.length > 0) {
                const message = `#Novo_Grupo
<b>Grupo:</b> ${chatName}
<b>ID:</b> <code>${chatId}</code>
<b>Link:</b> ${chatusername}`;
                bot.sendMessage(groupId, message, { parse_mode: "HTML" }).catch(
                    (error) => {
                        console.error(
                            `Erro ao enviar mensagem para o grupo ${groupId}: ${error}.`
                        );
                    }
                );
            }

            bot.sendMessage(
                chatId,
                "Você adicionou *TeN Clima* em seu grupo.\nUse /help para saber como usar os comandos.",
                { parse_mode: "Markdown",
                  disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Suporte",
                                    url: "https://t.me/tensupport_bot",
                                },
                            ],
                        ],
                    },
                }
            );
        }
        const developerMembers = msg.new_chat_members.filter(
            (member) => member.is_bot === false && is_dev(member.id)
        );

        if (developerMembers.length > 0) {
            const message1 = `👨‍💻 <b>Um dos meus desenvolvedores entrou no grupo. </b> <a href="tg://user?id=${developerMembers[0].id}">${developerMembers[0].first_name}</a> seja bem-vinde.`;
            bot.sendMessage(chatId, message1, { parse_mode: "HTML" }).catch(
                (error) => {
                    console.error(
                        `Erro ao enviar mensagem para o grupo ${chatId}: ${error}.`
                    );
                }
            );
        }
    } catch (err) {
        console.error(err);
    }
});

bot.on("left_chat_member", async (msg) => {
    const botUser = await bot.getMe();
    if (msg.left_chat_member.id === botUser.id) {
        console.log("Bot left the group!");

        try {
            const chatId = msg.chat.id;
            const chat = await ChatModel.findOneAndDelete({ chatId });
            console.log(
                `Grupo ${chat.chatName} (${chat.chatId}) removido do banco de dados.`
            );
        } catch (err) {
            console.error(err);
        }
    }
});


function timeFormatter(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hoursFormatted = String(hours).padStart(2, "0");
    const minutesFormatted = String(minutes).padStart(2, "0");
    const secondsFormatted = String(secs).padStart(2, "0");

    return `${hoursFormatted}:${minutesFormatted}:${secondsFormatted}`;
}

bot.onText(/\/ping/, async (msg) => {
    const start = new Date();
    const replied = await bot.sendMessage(msg.chat.id, "Pong!");
    const end = new Date();
    const m_s = end - start;
    const uptime = process.uptime();
    const uptime_formatted = timeFormatter(uptime);
    await bot.editMessageText(
        `*Ping:* \`${m_s}ms\`\n*Uptime:* \`${uptime_formatted}\``,
        {
            chat_id: replied.chat.id,
            message_id: replied.message_id,
            parse_mode: "Markdown",
        }
    );
});

bot.onText(/^(\/broadcast|\/bc)\b/, async (msg, match) => {
    const user_id = msg.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (msg.chat.type !== "private") {
        return;
    }

    const query = match.input.substring(match[0].length).trim();
    if (!query) {
        return bot.sendMessage(
            msg.chat.id,
            "<b>Eu preciso de conteúdo para transmitir.</b>",
            { parse_mode: "HTML" }
        );
    }
    const sentMsg = await bot.sendMessage(msg.chat.id, "<i>Processando...</i>", {
        parse_mode: "HTML",
    });
    const web_preview = query.startsWith("-d");
    const query_ = web_preview ? query.substring(2).trim() : query;
    const ulist = await UserModel.find().lean().select("user_id");
    let sucess_br = 0;
    let no_sucess = 0;
    let block_num = 0;
    for (const { user_id } of ulist) {
        try {
            await bot.sendMessage(user_id, query_, {
                disable_web_page_preview: !web_preview,
                parse_mode: "HTML",
            });
            sucess_br += 1;
        } catch (err) {
            if (
                err.response &&
                err.response.body &&
                err.response.body.error_code === 403
            ) {
                block_num += 1;
            } else {
                no_sucess += 1;
            }
        }
    }
    await bot.editMessageText(
        `
<b>Transmissão para usuários concluída</b>
• <b>Total de usuários:</b> ${ulist.length}
• <b>Total de usuários que receberam:</b> ${sucess_br}
• <b>Total de usuários que bloquearam o bot:</b> ${block_num}
• <b>Falhas:</b> ${no_sucess}
    `,
        {
            chat_id: sentMsg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: "HTML",
        }
    );
});

bot.onText(/\/dev/, async (message) => {
    const userId = message.from.id;
    if (message.chat.type !== "private") {
        return;
    }
    const firstName = message.from.first_name;
    const message_start_dev = `Olá, <b>${firstName}</b>.\nVocê está no painel de desenvolvedor do <b>TeN Clima</b>:`;
    const options_start_dev = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Suporte",
                        url: "https://t.me/tensupport_bot",
                    },
                ],
                [
                    {
                        text: "Lista de comandos",
                        callback_data: "commands",
                    },
                ],
            ],
        },
    };
    bot.on("callback_query", async (callbackQuery) => {
        if (callbackQuery.message.chat.type !== "private") {
            return;
        }
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        if (callbackQuery.data === "commands") {
            const commands = [
                "/stats - Estatística de grupos, usuários e mensagens enviadas",
                "/broadcast ou /bc - envia conteúdo para todos usuários",
                "/ping - para ver latência da VPS",
                "/groups - para ver todos os grupos onde estou adicionado",
                "/sendgp - encaminha conteúdo para grupos",
            ];
            await bot.editMessageText(
                "<b>Lista de Comandos:</b> \n\n" + commands.join("\n"),
                {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Voltar",
                                    callback_data: "back_to_start",
                                },
                            ],
                        ],
                    },
                }
            );
        } else if (callbackQuery.data === "back_to_start") {
            await bot.editMessageText(message_start_dev, {
                parse_mode: "HTML",
                chat_id: chatId,
                message_id: messageId,
                disable_web_page_preview: true,
                reply_markup: options_start_dev.reply_markup,
            });
        }
    });
    if (is_dev(userId)) {
        bot.sendMessage(userId, message_start_dev, options_start_dev);
    } else {
        bot.sendMessage(message.chat.id, "Você não é um desenvolvedor.");
    }
});

const channelStatusId = process.env.channelStatusId;

async function sendStatus() {
    const start = new Date();
    const replied = await bot.sendMessage(channelStatusId, "Bot está LIGADO.");
    const end = new Date();
    const m_s = end - start;
    const uptime = process.uptime();
    const uptime_formatted = timeFormatter(uptime);
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments();
    await bot.editMessageText(
        `#Status\n\nStatus: LIGADO\nPing: ${m_s}ms\nUptime: ${uptime_formatted}\nUsuários: ${numUsers}\nChats: ${numChats}`,
        {
            chat_id: replied.chat.id,
            message_id: replied.message_id,
            parse_mode: "Markdown",
        }
    );
}

function timeFormatter(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hoursFormatted = String(hours).padStart(2, "0");
    const minutesFormatted = String(minutes).padStart(2, "0");
    const secondsFormatted = String(secs).padStart(2, "0");

    return `${hoursFormatted}:${minutesFormatted}:${secondsFormatted}`;
}

const job = new CronJob(
    "00 12 * * *",
    sendStatus,
    null,
    true,
    "America/Sao_Paulo"
);

bot.onText(/^\/groups/, async (message) => {
    const user_id = message.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (message.chat.type !== "private" || message.chat.type === "group" || message.chat.type === "supergroup") {
        return;
    }

    try {
        const chats = await ChatModel.find().sort({ chatId: 1 });

        let contador = 1;
        let chunkSize = 3900 - message.text.length;
        let messageChunks = [];
        let currentChunk = "";

        for (let chat of chats) {
            if (chat.chatId < 0) {
                let groupMessage = `<b>${contador}.</b> <b>Grupo</b> ${chat.chatName} · <b>ID:</b> <code>${chat.chatId}</code>\n`;
                if (currentChunk.length + groupMessage.length > chunkSize) {
                    messageChunks.push(currentChunk);
                    currentChunk = "";
                }
                currentChunk += groupMessage;
                contador++;
            }
        }
        messageChunks.push(currentChunk);

        let index = 0;

        const markup = (index) => {
            return {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: `<< ${index + 1}`,
                                callback_data: `groups:${index - 1}`,
                                disabled: index === 0,
                            },
                            {
                                text: `>> ${index + 2}`,
                                callback_data: `groups:${index + 1}`,
                                disabled: index === messageChunks.length - 1,
                            },
                        ],
                    ],
                },
                parse_mode: "HTML",
            };
        };

        await bot.sendMessage(
            message.chat.id,
            messageChunks[index],
            markup(index)
        );

        bot.on("callback_query", async (query) => {
            if (query.data.startsWith("groups:")) {
                index = Number(query.data.split(":")[1]);
                if (
                    markup(index).reply_markup &&
                    markup(index).reply_markup.inline_keyboard
                ) {
                    markup(index).reply_markup.inline_keyboard[0][0].disabled =
                        index === 0;
                    markup(index).reply_markup.inline_keyboard[0][1].disabled =
                        index === messageChunks.length - 1;
                }
                await bot.editMessageText(messageChunks[index], {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    ...markup(index),
                });
                await bot.answerCallbackQuery(query.id);
            }
        });
    } catch (error) {
        console.error(error);
    }
});

bot.onText(/\/sendgp/, async (msg, match) => {
    const user_id = msg.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (msg.chat.type !== "private") {
        return;
    }

    const sentMsg = await bot.sendMessage(msg.chat.id, "<i>Processando...</i>", {
        parse_mode: "HTML",
    });
    const web_preview = match.input.startsWith("-d");
    const query = web_preview ? match.input.substring(6).trim() : match.input;
    const ulist = await ChatModel.find().lean().select("chatId");
    let success_br = 0;
    let no_success = 0;
    let block_num = 0;

    if (msg.reply_to_message) {
        const replyMsg = msg.reply_to_message;
        for (const { chatId } of ulist) {
            try {
                await bot.forwardMessage(
                    chatId,
                    replyMsg.chat.id,
                    replyMsg.message_id
                );
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    } else {
        for (const { chatId } of ulist) {
            try {
                await bot.sendMessage(chatId, query, {
                    disable_web_page_preview: !web_preview,
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id,
                });
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    }

    await bot.editMessageText(
        `
<b>Transmissão para grupos concluída</b>
• <b>Total de grupos:</b> ${ulist.length}
• <b>Total de grupos onde foi enviada:</b> ${success_br}
• <b>Total de grupos que removeram o bot:</b> ${block_num}
• <b>Falhas:</b> ${no_success}
    `,
        {
            chat_id: sentMsg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: "HTML",
        }
    );
});

function sendBotOnlineMessage() {
    console.log(`TeN Clima iniciado com sucesso.`);
    bot.sendMessage(groupId, `#TeNClima #ONLINE\n\nBot está em funcionamento.`);
}

function sendBotOfflineMessage() {
    console.log(`TeN Clima encerrado com sucesso.`);
    bot.sendMessage(groupId, `#TeNClima #OFFLINE\n\nBot está desligado.`)
        .then(() => {
            process.exit(0); // Encerra o processo do bot após enviar a mensagem offline
        })
        .catch((error) => {
            console.error("Erro ao enviar mensagem de desligamento:", error, ".");
            process.exit(1); // Encerra o processo com um código de erro
        });
}

process.on('SIGINT', () => {
    sendBotOfflineMessage();
});

sendBotOnlineMessage();
