    // My Imports
    import * as configPrivate from './config.private';
    import * as codeVerification from './utils/codigoVerificacion';
    import {
        sendMail
    } from './utils/sendMail';
    import {
        sendSms
    } from './utils/sendSms';
    import {
        Matching
    } from '@andes/match';
    import * as moment from 'moment';


    // Imports 3rd Parties
    let counter = 0;
    let expirationOffset = 1000 * 60 * 60 * 24 * 365;
    let mongoClient = require('mongodb').MongoClient;
    let winston = require('winston');
    let cantidadMatch = 0;
    let contador = 0;
    let urlAndes = configPrivate.urlMongoAndes;
    let urlMpi = configPrivate.urlMongoMpi;
    let arrayPromesas = [];
    let coleccionPacientesApp = 'pacienteApp';
    let coleccionPacientes = 'paciente';
    let coleccionCacheSend = 'sendMessageCache';
    let logger = new(winston.Logger)({
        transports: [
            new(winston.transports.Console)(),
            new(winston.transports.File)({
                filename: 'activador.log'
            })
        ]
    });
    
    let now = moment().subtract(2,'days').toDate();
    let condicion = {
        createdAt: {
            $gte: now
        }
    };

    mongoClient.connect(urlMpi, function (err, db) {
        mongoClient.connect(urlAndes, function (err, db2) {

            db.collection(coleccionPacientes).find(condicion).toArray(function (error, pacientes: any) {
                if (error) {
                    console.log('Error al conectarse a la base de datos ', error);
                }
                if (pacientes.length > 0) {
                    pacientes.forEach(pac => {
                        let p = new Promise(async(resolve, reject) => {
                            let crtlFecha = moment(pac.fechaNacimiento);
                            // No enviamos a menores de 18 años
                            if (moment().diff(crtlFecha,'years') <= 18) {
                                return resolve()
                            }
                            let celular = searchContacto(pac, 'celular');
                            if (celular) {
                                let pacienteVinculado = await buscaPacienteVinculado(pac, db2);

                                if (pacienteVinculado) {
                                    resolve();

                                    //     let matcheo = await matchPacientes(pac, pacienteVinculado);
                                    //     if (matcheo >= 0.95) {

                                    //         if (pacienteVinculado.pacientes.length <= 0) {

                                    //             logger.log('info', 'Envío sms a : ', pac.documento, pac.nombre, pac.apellido);

                                    //             let objAdd = {
                                    //                 id: pac._id,
                                    //                 relacion: 'principal',
                                    //                 addedAt: new Date()

                                    //             }
                                    //             pacienteVinculado.pacientes.push(objAdd);
                                    //             codeVerification.createUniqueCode(db2, coleccionPacientesApp)
                                    //                 .then(codigo => {

                                    //                     db2.collection(coleccionPacientesApp).updateOne({
                                    //                             _id: pacienteVinculado._id
                                    //                         }, {

                                    //                             $set: {
                                    //                                 pacientes: pacienteVinculado.pacientes,
                                    //                                 envioCodigoCount: 1,
                                    //                                 codigoVerificacion: codigo,
                                    //                                 //telefono: celular,
                                    //                                 email: null,
                                    //                                 activacionApp: false,
                                    //                                 estadoCodigo: false,
                                    //                                 expirationTime: new Date(Date.now() + expirationOffset),
                                    //                             }

                                    //                         },
                                    //                         function (err, rta) {
                                    //                             if (err) {
                                    //                                 console.log('Error: ', err);
                                    //                             } else {
                                    //                                 let paciente = pacienteVinculado;
                                    //                                 //paciente.telefono = celular;
                                    //                                 paciente.email = null;
                                    //                                 paciente.codigoVerificacion = codigo;
                                    //                                 enviarCodigoVerificacion(paciente, db2);
                                    //                             }
                                    //                             resolve();
                                    //                         })
                                    //                 })


                                    //         } else {
                                    //             resolve();
                                    //         }
                                    //     } else {
                                    //         resolve();
                                    //     }
                                } else {

                                    codeVerification.createUniqueCode(db2, coleccionPacientesApp)
                                        .then(codigo => {
                                            // Creamos el pacienteApp y lo insertamos con un codigo de verificación
                                            let dataPacienteApp: any = {
                                                nombre: pac.nombre,
                                                apellido: pac.apellido,
                                                email: null,
                                                password: null,
                                                telefono: celular,
                                                envioCodigoCount: 1,
                                                nacionalidad: 'Argentina',
                                                documento: pac.documento,
                                                fechaNacimiento: pac.fechaNacimiento,
                                                sexo: pac.sexo,
                                                genero: pac.genero,
                                                codigoVerificacion: codigo,
                                                expirationTime: new Date(Date.now() + expirationOffset),
                                                permisos: [],
                                                pacientes: [{
                                                    id: pac._id,
                                                    relacion: 'principal',
                                                    addedAt: new Date()
                                                }]
                                            };
                                            db2.collection(coleccionPacientesApp).insertOne(dataPacienteApp, function (err, user) {
                                                if (err) {
                                                    console.log('error', err);
                                                    resolve();
                                                } else {
                                                    enviarCodigoVerificacion(dataPacienteApp, db2, resolve);
                                                }
                                                
                                            });
                                        });
                                }
                            } else {

                                resolve();
                            }

                        })
                        arrayPromesas.push(p);

                    });

                    Promise.all(arrayPromesas).then(resultado => {
                        db.close();
                        db2.close();
                        console.log('Finalizo el proceso: ', Date.now());
                    })



                } else {
                    console.log('No existen pacientes con esa condición');
                }
            });
        });
    });

    function searchContacto(pacienteData, key) {
        if (pacienteData.contacto) {
            for (let i = 0; i < pacienteData.contacto.length; i++) {
                if (pacienteData.contacto[i].tipo === key) {
                    return pacienteData.contacto[i].valor;
                }
            }
        }
        return null;
    }

    function buscaPacienteVinculado(unPaciente: any, db2) {
        return new Promise((resolve, reject) => {

            db2.collection(coleccionPacientesApp).findOne({
                'documento': unPaciente.documento
            }, function (err, item) {
                if (err) {
                    console.log('entro por este error:', err);
                    reject(err);
                } else {
                    if (item) {
                        resolve(item);
                    } else {
                        resolve(null);
                    }

                }

            });

        });
    };

    function matchPacientes(pacienteApp, pacienteVinculado) {
        return new Promise((resolve, reject) => {
            let match = new Matching();
            let pacApp = {
                apellido: pacienteApp.apellido,
                nombre: pacienteApp.nombre,
                sexo: pacienteApp.sexo.toUpperCase(),
                fechaNacimiento: pacienteApp.fechaNacimiento,
                documento: pacienteApp.documento
            };
            let pac = {
                apellido: pacienteVinculado.apellido,
                nombre: pacienteVinculado.nombre,
                sexo: pacienteVinculado.sexo.toUpperCase(),
                fechaNacimiento: pacienteVinculado.fechaNacimiento,
                documento: pacienteVinculado.documento
            }
            let valorMatching = match.matchPersonas(pacApp, pac, configPrivate.mpi.weightsDefault, 'Levenshtein');
            if (valorMatching) {
                resolve(valorMatching)
            } else {
                resolve(null)
            }
        })
    };

    function enviarCodigoVerificacion(user, db, resolve) {
        // Guarda el mensaje para dejarlo pendiente de envío en una collection temporal.

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

        let userdata = {
            message: mensajeGenerico,
            subject: 'Ministerio de Salud :: ANDES :: Código de activación',
            phone: user.telefono,
            email: user.email,
            from: 'Robot de activación automático',
            status: 'pending',
            createdAt: new Date(),
            tries: 0
        }

        save(userdata, db, resolve);
    }

    function save(usuario, db, resolve) {

        db.collection(coleccionCacheSend).insertOne(usuario, function (err) {
            if (err) {
                console.log('Error: ', err);
            }
            resolve();
        });
    }



    // if (user.email) {
    //     sendMail(mailOptions);
    // }

    // sendSms(smsOptions, function (res) {

    //     if (res === '0') {
    //         logger.log('info', 'El SMS se envío correctamente', user.documento);
    //     } else {
    //         logger.log('info', 'El SMS ha fallado', user.documento)
    //         logger.log('info', '' )
    //     }
    // });