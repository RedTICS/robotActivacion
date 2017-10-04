import { sendSms } from './utils/sendSms';
import { sendMail } from './utils/sendMail';
import * as configPrivate from './config.private';
let winston = require('winston');

let logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)(),
        new(winston.transports.File)({
            filename: 'activador.log'
        })
    ]
});

function enviarCodigoVerificacion(user, callback) {
    let mensajeGenerico = 'Ministerio de Salud :: ANDES :: Actualice la APP desde https://goo.gl/KMPzne y regístrese con este código de activación : ' + user.codigoVerificacion; 
    let mailOptions: any = {
        from: configPrivate.enviarMail.host,
        to: user.email,
        subject: 'Ministerio de Salud :: ANDES :: Código de activación',
        text: mensajeGenerico,
        html: mensajeGenerico
    };

    let smsOptions: any = {
        telefono: user.telefono,
        mensaje: mensajeGenerico
    };
    if (user.email) {
        sendMail(mailOptions);
    }
    
    sendSms(smsOptions, function (res) {        
        if (res === '0') {
            logger.log('info', 'El SMS se envío correctamente', user.documento);
        } else {
            logger.log('info', 'El SMS ha fallado', user.documento)
        }
        callback(res);
    });
}

let coleccionPacientesApp = 'pacienteApp';
let coleccionPacientes = 'paciente';
let mongoClient = require('mongodb').MongoClient;
let urlAndes = configPrivate.urlMongoAndes;
let urlMpi = configPrivate.urlMongoMpi;

let condicion = {
    documento: {
        $in: ['10194984',
        '10206364',
        '11588913',
        '11640649',
        '11884694',
        '12710186',
        '13202417',
        '13558610',
        '13978880',
        '14519153',
        '14870506',
        '16052402',
        '16552120',
        '17065402',
        '17714610',
        '18028616',
        '18162855',
        '18872439',
        '19006118',
        '20292196',
        '20436921',
        '2047969',
        '20558556',
        '20933198',
        '21389767',
        '21459579',
        '21518893',
        '21658689',
        '21681437',
        '21952644',
        '22141641',
        '22482715',
        '22825274',
        '23001002',
        '23172200',
        '23384417',
        '23895366',
        '24082608',
        '24700565',
        '24777599',
        '24877092',
        '25043500',
        '25656376',
        '25725561',
        '26144850',
        '26476871',
        '26541059',
        '26767053',
        '26810058',
        '27477065',
        '27773138',
        '28160450',
        '28485282',
        '28621217',
        '28621498',
        '28792706',
        '28982109',
        '29418683',
        '29452564',
        '29919971',
        '30231585',
        '31099351',
        '31756331',
        '31820334',
        '32368834',
        '32428478',
        '32534881',
        '33566681',
        '34657458',
        '34740719',
        '34866389',
        '34961894',
        '35492771',
        '35492771',
        '35557069',
        '36371684',
        '37101641',
        '37657946',
        '37757977',
        '38204587',
        '38300512',
        '39067213',
        '40627387',
        '41608844',
        '44605168',
        '44909244',
        '44909244',
        '44909244',
        '44909244',
        '44909244',
        '45375032',
        '45734422',
        '47243879',
        '47661806',
        '4936932',
        '49893704',
        '50697095',
        '50876721',
        '51317979',
        '51418617',
        '52081182',
        '52311647',
        '52314778',
        '52315675',
        '52316570',
        '53070743',
        '53563646',
        '53969056',
        '53969369',
        '53971216',
        '5447137',
        '54493497',
        '54852060',
        '54856458',
        '54856938',
        '54856944',
        '55155930',
        '55159009',
        '55159092',
        '55159097',
        '55160401',
        '55631016',
        '55632300',
        '55633304',
        '55634512',
        '56001283',
        '56001816',
        '56003381',
        '56004028',
        '56004763',
        '56005538',
        '56006040',
        '56006451',
        '56006494',
        '5620847',
        '5996112',
        '6538416',
        '8601201',
        '92136045',
        '92402744',
        '92435766',
        '92579427',
        '92740799',
        '92851450',
        '92944173',
        '92949036',
        '93052745',
        '94103443',
        '94104390',
        '94180560',
        '94592678',
        '94806702',
        '94892038']
    }
};
mongoClient.connect(urlAndes, function (err, db) {
    
    db.collection(coleccionPacientesApp).find(condicion).toArray(function (error, pacientes: any) {

        pacientes.forEach(pac => {
            let fecha = new Date(pac.fechaNacimiento);
            if (fecha.getFullYear() < 2001) {
                // console.log('es mayor de edad', pac.documento);
                enviarCodigoVerificacion(pac, function (res) {
                    if (res === '0') {
                        save(db, pac, 0);
                    } else {
                        // save(db, pac, 3);
                    }
                });
            } else {
                // console.log('no es mayor de edad', pac.documento);
            }
        });

        db.close();
    });

});

function save(db, pac, status) {
    db.collection(coleccionPacientesApp).updateOne({
        _id: pac._id
    }, {
    
        $set: { 
            envioCodigoCount: status, 
        }    
    },
    function (err, rta) {
        if (err) {
            console.log('Error: ', err);
        } else {
             
        } 
    });
}