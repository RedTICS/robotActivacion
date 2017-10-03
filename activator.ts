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
    let logger = new(winston.Logger)({
        transports: [
            new(winston.transports.Console)(),
            new(winston.transports.File)({
                filename: 'activador.log'
            })
        ]
    });

    let condicion = {
        createdAt: {
            $gte: new Date("2017-09-26T00:00:00.000Z")
        },
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

                            let celular = searchContacto(pac, 'celular');
                            if (celular) {
                                let pacienteVinculado = await buscaPacienteVinculado(pac, db2);

                                if (pacienteVinculado) {

                                    let matcheo = await matchPacientes(pac, pacienteVinculado);
                                    if (matcheo >= 0.95) {

                                        if (pacienteVinculado.pacientes.length <= 0) {

                                            logger.log('info', 'Envío sms a : ', pac.documento, pac.nombre, pac.apellido);

                                            let objAdd = {
                                                id: pac._id,
                                                relacion: 'principal',
                                                addedAt: new Date()

                                            }
                                            pacienteVinculado.pacientes.push(objAdd);
                                            codeVerification.createUniqueCode(db2, coleccionPacientesApp)
                                                .then(codigo => {

                                                    db2.collection(coleccionPacientesApp).updateOne({
                                                            _id: pacienteVinculado._id
                                                        }, {

                                                            $set: {
                                                                pacientes: pacienteVinculado.pacientes,
                                                                envioCodigoCount: 1,
                                                                codigoVerificacion: codigo,
                                                                telefono: celular,
                                                                email: null,
                                                                activacionApp: false,
                                                                estadoCodigo: false,
                                                                expirationTime: new Date(Date.now() + expirationOffset),
                                                            }

                                                        },
                                                        function (err, rta) {
                                                            if (err) {
                                                                console.log('Error: ', err);
                                                            } else {
                                                                let paciente = pacienteVinculado;
                                                                paciente.telefono = celular;
                                                                paciente.email = null;
                                                                paciente.codigoVerificacion = codigo;
                                                                enviarCodigoVerificacion(paciente);
                                                            }
                                                            resolve();
                                                        })
                                                })


                                        } else {
                                            resolve();
                                        }
                                    } else {
                                        resolve();
                                    }
                                } else {
                                    contador++;

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

                                                } else {
                                                    // console.log('Paciene por aca: ',dataPacienteApp);
                                                    enviarCodigoVerificacion(user);
                                                }
                                                resolve();
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

    function enviarCodigoVerificacion(user) {
        console.log('El usuario de mail: ', user);
        let mailOptions: any = {
            from: configPrivate.enviarMail.host,
            to: user.email,
            subject: 'Ministerio de Salud :: ANDES :: Código de activación',
            text: 'Estimado ' + user.email + ', Su código de activación para ANDES Mobile es: ' + user.codigoVerificacion,
            html: 'Estimado ' + user.email + ', Su código de activación para ANDES Mobile es: ' + user.codigoVerificacion,
        };

        let smsOptions: any = {
            telefono: user.telefono,
            mensaje: 'Ministerio de Salud :: ANDES :: Te envía tú código de activación APP Mobile: ' + user.codigoVerificacion + '. descarga la APP de https://goo.gl/KMPzne'
        };
        if (user.email) {
            sendMail(mailOptions);
        }
        
        sendSms(smsOptions, function (res) {
            if (res === '0') {
                logger.log('info', 'El SMS se envío correctamente');
            }
        });
    }