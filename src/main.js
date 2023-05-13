import {Telegraf, session} from 'telegraf';
import {message} from 'telegraf/filters'; //в телеграфе есть специальные фильтры, экспортируем один из них. Тут идея в том
//что мы можем отправлять в бот что угодно: картинки, текст, видео, голосовые сообщения, файлы, стикеры и с помощью
//фильтра мы можем фильтровать на входной поток

import {code} from 'telegraf/format' //форматирует стилистику текста т.е. сделает его более приятным для прочтения

import config from 'config'
import {ogg} from './ogg.js'
import { openai } from './openai.js';


console.log(config.get('TEST_ENV'))


//ниже сделаем переменную INITIAL_SESSION это по аналогии со стейтом. 
//Каждая сессия соответствует каждому пользователю
const INITIAL_SESSION = {
    messages: [],
}


//в BotFather создаем нового бота командой /newbot и получаем токен который занесем в конструктор ниже 
const bot = new Telegraf(config.get("TELEGRAM_TOKEN"))

bot.use(session()) //мидлвейер session нужен чтобы сохранять контекст общения (в тетради описал чуть подробнее проблему)
//теперь добавим новую команду и назовем ее new и когда мы ее будем задавать то будет создаваться новый контекст - новая беседа

//ctx - это контекст и в нем много довольно объектов
//reply - это ответ в чате
bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})

bot.command('test', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Test passed')
})

//ниже команда start аналогична команде new т.к. когда пользователь начинает взаимодействовать с ботом он впринципе инициализирует сессию
bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})

//мы можем также обрабатывать какие то входные данные - например текстовое сообщение и для этого 
//установим фильтр message и теперь мы можем отправить любой текст
// bot.on(message('text'), async ctx => {
//     await ctx.reply(JSON.stringify(ctx.message, null, 2))
// })


//ниже мы для проверки отправляем сообщение 
// bot.on(message('text'), async ctx => {
//     try {
        
//         const messages = [{role: openai.roles.USER, content: "Привет, как тебя зовут?"}]
//         const response = await openai.chat(messages) //ну и теперь получаем ответ
        
//         await ctx.reply(response.content)


//     } catch (e) {
//         console.log("Что то пошло не так", e.message)
//     }
       
//     })

//если ниже теперь отправить просто текст то ничего не произойдет и это логично. А если отправим голосовуху - он ее
//переведет в текст (хотя это у автора так - наверное из-за того что у него премиум) и в ответе выведет 
//характеристики отправленного файла -  duration, file_id (т.е. он где то хранится на телеграмовских серверах), file_size  и т.д.
// bot.on(message('voice'), async ctx => {
//     await ctx.reply(JSON.stringify(ctx.message.voice, null, 2))
// })
// Но самое главное нам чтобы госом  общаться с gpt нужно для начала перевести голосовую команду в текст. 
// Этот функционал есть также у OpenAI т.е. мы можем воспользоваться его API - можно глянуть на 
// platform.openai.com/docs/introduction и тут есть API reference и если мы посмотрим на функционал 
// Speech to text то увидим что мы можем отправлять сюда файл не более 25 мб и входящие форматы не поддерживают 
// тип ogg в котором сохраняются голосовухи telegram т.е. первое что нам  предстоит сделать это сконвертировать ogg например в mp3.   
bot.on(message('voice'), async ctx => {
    //в первую очередь добавим проверку тут что елси вдруг по какой либо причине session у нас не опредилился (такое может быть) то мы
    //будем задавать ему значение INITIAL_SESSION
    ctx.session ??= INITIAL_SESSION  

    //добавим тут try - catch т.к. могут быть какие - то ошибки и если мы где нить ошибемся то сразу поймем где конкретно
    try {
        //ниже сделаем такую штуку чтобы понимать что бот работает
        await ctx.reply(code('Сообщение принял. Жду ответ от сервера ...'))   //code - форматирует стилистику текста т.е. сделает его более приятным для прочтения
        

        //перед тем как перейти к функционалу по трансформированию данных мы создадим константу userId 
        //которая будет соответствовать юзеру который общается с ботом и сразу превратим в строку:
        const userId = String(ctx.message.from.id)
        //итак, для начала нам нужно получить ссылку на файл голосового сообщения. Для этого ниже ждем пока в контексте
        //и в его объекте телеграм в котором есть определенные методы и берем метод getFileLink:
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)

        const oggPath = await ogg.create(link.href, userId) //т.е. из userId будем формировать название файла в ф-ии create и по итогу oggPath это будет путь к голосовому файлу в папке voices
        //выше мы имеем путь к нашей голосовухе в папке voices, ниже конвертируем ее в mp3 и получим путь уже к mp3 файлу
        const mp3Path = await ogg.toMp3(oggPath, userId)

        const text = await openai.transcription(mp3Path) //т.е. переводим mp3 в текст
        await ctx.reply(code(`Ваш запрос: ${text}`))
        

        //ниже сформируем message (о нем расписано в ф-ии chat в файле openai.js)
        // const messages = [{role: openai.roles.USER, content: text}]
        //сделаем это в сессии
        ctx.session.messages.push({role: openai.roles.USER, content: text})

        const response = await openai.chat(ctx.session.messages) //ну и теперь получаем ответ передав как аргумент массив объектов

        //и теперь как только мы выше получили какой то response нам нужно добавить это сообщение в контекст
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        
        await ctx.reply(response.content)

        // await ctx.reply(JSON.stringify(link, null, 2)) //и тут в ответе увидим: https://api.telegram.org/file/bot6205788529:AAHNFwrBeOaEbbmPAVsUjd9gEfNxmuWON4w/voice/file_0.oga"

       


        //но если мы выведем link в консоль console.log(link) то мы увидим что link это объект URL где есть много полезного но
        //видимо когда мы засовываем его в json он приводит его только к строке т.е. получает его href из объекта URL и нам как раз 
        //и нужно этот href вытащить 
        

     

    } catch (e) {
        console.log(`Error while voice message `, e.message)
        await ctx.reply(code(`Error while voice message : ${e.message}`))
    }
})



//ниже научим бота также общаться текстом
bot.on(message('text'), async ctx => {
    //в первую очередь добавим проверку тут что елси вдруг по какой либо причине session у нас не опредилился (такое может быть) то мы
    //будем задавать ему значение INITIAL_SESSION
    ctx.session ??= INITIAL_SESSION  

    //добавим тут try - catch т.к. могут быть какие - то ошибки и если мы где нить ошибемся то сразу поймем где конкретно
    try {
        //ниже сделаем такую штуку чтобы понимать что бот работает
        await ctx.reply(code('Сообщение принял. Жду ответ от сервера ...'))   //code - форматирует стилистику текста т.е. сделает его более приятным для прочтения
        


        ctx.session.messages.push({role: openai.roles.USER, content: ctx.message.text})
        const response = await openai.chat(ctx.session.messages) //ну и теперь получаем ответ передав как аргумент массив объектов
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content})

        
        await ctx.reply(response.content)

        // await ctx.reply(JSON.stringify(link, null, 2)) //и тут в ответе увидим: https://api.telegram.org/file/bot6205788529:AAHNFwrBeOaEbbmPAVsUjd9gEfNxmuWON4w/voice/file_0.oga"

       


        //но если мы выведем link в консоль console.log(link) то мы увидим что link это объект URL где есть много полезного но
        //видимо когда мы засовываем его в json он приводит его только к строке т.е. получает его href из объекта URL и нам как раз 
        //и нужно этот href вытащить 
        

     

    } catch (e) {
        console.log(`Error while voice message `, e.message)
        await ctx.reply(code(`Error while voice message : ${e.message}`))
    }
})








//выше мы все описали и теперь запускаем самого бота
bot.launch()



//ниже добавим что если вдруг nodejs у нас вдруг завершается
//то мы будем останавливать бота тоже по событию SIGINT
process.once('SIGINT', ()=>bot.stop('SIGINT'))
//И еще обработаем событие SIGTERM
process.once('SIGTERM', ()=>bot.stop('SIGTERM'))




