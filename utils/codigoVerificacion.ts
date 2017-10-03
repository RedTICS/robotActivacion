export function listadoCodigos(db: any, col: any) {
    return new Promise((resolve, reject) => {
        db.collection(col).find({
            codigoVerificacion: {
                $ne: null
            }
        }, {
            codigoVerificacion: 1,
            _id: 0
        }).toArray(function (err, listado) {
            if (listado) {
                let numeros = listado.map((item: any) => item.codigoVerificacion);
                resolve(numeros);
            } else {
                resolve([]);
            }
        })
    })
}

/**
 * Genera un código de verificación.
 * @param onlyNumber
 */
export function generarCodigoVerificacion(onlyNumber = true) {
    let codigo = '';
    let length = 6;
    let caracteres = onlyNumber ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }

    return codigo;
}

/**
 * Genera un codigo unico chequeando con la db de pacientes.
 */

export function createUniqueCode(db, col) {
    return listadoCodigos(db, col).then((listado:any) => {
        //console.log(listado);
        let codigo = generarCodigoVerificacion();
        while (listado.indexOf(codigo) >= 0) {
            codigo = generarCodigoVerificacion();
        }

        return Promise.resolve(codigo);

    });
}