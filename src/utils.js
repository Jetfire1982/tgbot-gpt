//эта утилита для того чтобы удалять файлы из папки voices

//в стандартном пакете fs есть также методы которые работают в формате promis - ов
import {unlink} from 'fs/promises'

export async function removeFile(path){
    //добавим try catch потому как всегда чтото может пойти не так
    try {
        await unlink(path) 
    } catch (e) {
        console.log('Error while removing file', e.message)
    }
}