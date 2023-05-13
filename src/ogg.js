import axios from 'axios';
import {createWriteStream} from 'fs'
import ffmpeg  from 'fluent-ffmpeg'; //это какбы ядро самой библиотеки кодеков
import installer from '@ffmpeg-installer/ffmpeg' //installer это то что позволяет производить конвертацию форматов

//ВАЖНО! Когда мы используем import и export es6 то мы не можем просто так обратиться к __dirname (текущая папка
//в которой находится данный файл) и нам нужнно сперва его определить. И для этого нам кое что придется импортировать
//из path и из url:
import {dirname, resolve} from 'path'
import { fileURLToPath } from 'url';
import { removeFile } from './utils.js';


//и теперь определим нашу __dirname. На самом деле один раз такое прописать как ниже и у нас будет готовая константа
//с которой мы можем взаимодейстововать 
const __dirname = dirname(fileURLToPath(import.meta.url)) //в import.meta.url будет это file:///D:/C++/GPTchatTelegram/src/ogg.js
//выше __dirname мы сделали чтобы выше в методе create ниже мы могли получить oggPath


//тут у нас будет функционал для работы с аудио
class OggConverter {
    constructor() { 
        ffmpeg.setFfmpegPath(installer.path) //добавили в конструктор настройки пути непосредсвтенно до конвертера
    }


    toMp3(input, output) {  //input - это путь к файлу ogg в папке voices и output это название выходного файла
        //т.к. мы делаем довольно сложные штуки то мы все это добавим в try catch для того чтобы четче 
        //понимать в случае ошибки что у нас пошло не так
        try {
            const outputPath = resolve(dirname(input), `${output}.mp3`) //сформировали путь до будущего файла mp3
            //у нас тут будет определенный асинхронный код а посему вернем тут Promise чтобы было проще с этим работать
            return new Promise((resolve, reject) => {
                //ниже показано как выглядит сама логика по трансформации ogg в mp3
                ffmpeg(input)
                    .inputOption('-t 30')
                    .output(outputPath) //в output указываем выходной файл который должен получиться и терерь вообще мы можем удалить файл ogg - функционал для этого описан в файле utils.js - смотри ниже мы вызываем removeFile из utils.js
                    .on('end', ()=>{ //ну и в случае когда логика завершится
                        removeFile(input) //удаляем ogg файл а после того как мы используем mp3 мы можем и его выпиливать
                        resolve(outputPath) 
                    })
                    .on('error', err => reject(err.message)) //в случае если случилась ошибка
                    .run() //после нам нужно все это запустить используя run
            })
            
        } catch (e) {
            console.log('Error while creating mp3', e.message) 
        }
    }

    //да у нас есть файл ogg с каким то голосовым сообщением но ведь он находится на удаленных серверах телеграмма
    //и нам сперва придется его скачать и сохранить в локальный файл и для этого и будет ф-ия create ниже. И самый простой
    //пакет который позволяет скачивать файлы это наш любимый axios но также дополнительно мы установим еще два пакета это
    //fluent-ffmpeg и @ffmpeg-installer/ffmpeg (про эти пакеты мне подсказал gpt т.к. я никогда не работал с ogg и 
    //не конвертировал их в mp3) т.е. устанавливаем все вместе командой:
    // npm i axios fluent-ffmpeg @ffmpeg-installer/ffmpeg
    //Наш метод create будет принимать url где хранится наш файл и filename т.е. имя файла в который мы все сохраним
    //по итогу метод create возьмет файл с серверов телеграма и сохранит временно в папке voices и вернет путь к файлу в voices
    async create(url, filename) {
        //для начала мы сделаем запрос с помощью axios и мы не будем писать get и т.о. его настроим, и очень важный 
        //параметр который нужно передать - это responseType со значением stream т.е. мы его будем как stream скачивать
        //и все это будет попадать в response. Хорошей практикой т.к. мы работаем тут с асинхронным кодом
        // считаестя все это положить в try catch
        try {
            const oggPath = resolve(__dirname, '../voices', `${filename}.ogg`)  //т.е. в метод мы передали текущую папку т.е. мы в src, далее выходим наверх, переходим в папку voices и добавляем название файла
            const response = await axios({
                method: 'get',
                url,
                responseType: 'stream'
            })

         

            //ниже в createWriteStream нам нужно передать путь по которому файл будет хранится и дальше stream будет его
            //записывать. Мы сделаем в корне папку voices где мы временно будем хранить голосовухи которые скачали и которые
            //конвертировали в mp3. И в этой папке мы создадим мини файл keep где ничего не будет чтобы он оставался в гите т.к. 
            //саму папку voices мы будем постоянно чистить т.е. keep вечно пустой файл заглушка

            //вообще т.к. метод create у нас работает не моментально т.е. это определенный асинхронный код то мы 
            //можем обернуть в Promise:
            return new Promise(resolve => {
                const stream = createWriteStream(oggPath) //т.о. мы получаем stream
                response.data.pipe(stream) //т.е. то что мы получаем от axios мы можем запайпить на stream. 
                //и чтобы понять что stream у нас завершился мы можем использовать событие ниже, и как только stream у нас
                //завершился и т.о. мы поймем что мы можем с этим дальшше работать мы вызовем resolve
                stream.on('finish', ()=>resolve(oggPath))
            })
    
        } catch (e) {
            console.log('Error while creating ogg', e.message)
        }
    }
}


export const ogg = new OggConverter()