//нам нужно наш mp3 файл перевести в тектс и для этого мы будем использовать апишку от OpenAi

import {Configuration, OpenAIApi} from 'openai'
import config from 'config'
import {createReadStream} from 'fs'


class OpenAI {

    roles  = { //про это сказано в ф-ии chat ниже
        ASSISTANT: 'assistant',
        USER: 'user',
        SYSTEM: 'system'
    }



    constructor(apiKey) {
        const configuration = new Configuration({ //делаем объект конфигурации - это из документации docs/libraries/node-js-library - только мы немного для удобства изменили
            apiKey,
          });
          this.openai = new OpenAIApi(configuration);
     }

    async chat(messages) { 
        try {
            const response = await this.openai.createChatCompletion({
               model: 'gpt-3.5-turbo', //в документации можно посмотреть какие модели у нас есть, смотри Chat completions и там говорят о моделях gpt-3.5-turbo и gpt-4 (но gpt-4 это бета и нужно подовать заявку) 
               messages  //это массив от одной мессаджи. 
                        //  У каждого сообщения есть:
                        //  - role (это enum и она может принимать три значения: System тут мы даем контекст как нужно себя 
                        //  боту вести, например "чат ты поэт 19 века а посему отвечай мне только в стихах" т.е. мы можем с помощью System заранее
                        // добавить какое то сообщение, User - это пользователь который нам пишет, Assistant - это уже ответ GPT чата), Выше мы сделали эти константы в массиве чтобы не запоминать их 
                        //  - content (это просто текст) 
                        //  - и возможно опционально name
                        //  Короче в функцию нашу chat нужно правильно передавать объект messages
            })
            return response.data.choices[0].message
        } catch (e) {
            console.log('Error while gpt chat ', e.message)
        }

    }


    //метод ниже переводит голос в текст. Смотрим все в https://platform.openai.com/docs/guides/speech-to-text (правда примеров 
    //на nodejs почему то нет а раньше были). Суть в том что у них есть библиотека в npm которая позволяет легко взаимодействовать
    //с этой апишкой это в разделе docs/libraries/node-js-library и для этого его устанавливаем npm install openai
    async transcription(filepath) {
        try {
            const response  = await this.openai.createTranscription( //в этот метод мы передаем не путь до файла а именно сам файл и соответственно нам
                createReadStream(filepath),       //необходимо создать из него стрим - это как один из вариантов
                'whisper-1'  //так называется модель которая будет читать аудио файл
            )
            return response.data.text                                     
        } catch (e) {
            console.log('Error while transcription ', e.message)
        }
     }
}

export const openai = new OpenAI(config.get('OPENAI_KEY')) 