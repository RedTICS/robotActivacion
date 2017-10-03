import {
    sendSms
} from './utils/sendSms';


let smsOptions: any = {
    telefono: '2994271675',
    mensaje: 'Ministerio de Salud :: ANDES :: Te envía tú código de activación APP Mobile: '
};


for(let i=0; i<=20; i++) {
    sendSms(smsOptions, function (res) {
        if (res === '0') {
            console.log('El SMS se envío correctamente');
        } else {
            console.log('info', 'El SMS ha fallado')
        }
    });
}