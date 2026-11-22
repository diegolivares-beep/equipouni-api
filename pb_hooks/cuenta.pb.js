/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   CUENTA Y FICHA COMPARTEN NOMBRE Y TELÉFONO
   ------------------------------------------------------------
   Pedido del cliente (17-nov): que el nombre y el teléfono de la cuenta
   estén enlazados con la ficha, y que al cambiar uno se actualice el
   otro. Hasta acá la ficha los copiaba una sola vez, al crearse, y de
   ahí cada uno quedaba con su versión: el correo de aviso saludaba con
   el nombre de la cuenta y la productora recibía el de la ficha.

   El correo no se sincroniza porque la ficha no lo guarda: lee siempre
   el de la cuenta.

   Va en el servidor y no en la página para que valga venga el cambio
   de donde venga (Mi cuenta, Mi ficha o el panel de administración).

   Regla de revisión (decisión del 22-nov): si cambia el nombre en la
   cuenta y la ficha ya estaba revisada, la ficha vuelve a la cola, igual
   que si lo hubiera cambiado en la ficha. El teléfono no la devuelve.

   Por qué no hay un bucle: guardar la ficha dispara su hook, que mira la
   cuenta, y viceversa. Cada lado guarda solo si el valor es distinto,
   así que la segunda pasada encuentra todo igual y no hace nada.

   La lección de siempre: cada hook corre en su propio contexto y no ve
   nada declarado fuera, por eso cada uno trae todo lo que necesita.
   ============================================================ */

/* 1. Cambió la cuenta: se lleva a la ficha. */
onRecordAfterUpdateSuccess(function (e) {
  try {
    var fichas = $app.findRecordsByFilter(
      'fichas', 'usuario = {:u}', '', 1, 0, { u: e.record.id });
    if (fichas.length) {
      var f = fichas[0];
      var nombre = String(e.record.get('nombre') || '').trim();
      var telefono = String(e.record.get('telefono') || '').trim();
      var cambioNombre = nombre && nombre !== String(f.get('representante_nombre') || '');
      var cambioTelefono = telefono && telefono !== String(f.get('representante_telefono') || '');

      if (cambioNombre || cambioTelefono) {
        if (cambioNombre) {
          f.set('representante_nombre', nombre);
          var estado = f.get('estado');
          if (estado === 'validada' || estado === 'correccion') {
            f.set('estado', 'pendiente');
            f.set('aviso_estado', '');
          }
        }
        if (cambioTelefono) f.set('representante_telefono', telefono);
        $app.save(f);
      }
    }
  } catch (err) {
    console.log('cuenta a ficha: ' + err);
  }
  e.next();
}, 'users');

/* 2. Se creó o cambió la ficha: se lleva a la cuenta. */
function fichaACuenta(e) {
  try {
    var u = $app.findRecordById('users', e.record.get('usuario'));
    var nombre = String(e.record.get('representante_nombre') || '').trim();
    var telefono = String(e.record.get('representante_telefono') || '').trim();
    var cambio = false;
    if (nombre && nombre !== String(u.get('nombre') || '')) { u.set('nombre', nombre); cambio = true; }
    if (telefono && telefono !== String(u.get('telefono') || '')) { u.set('telefono', telefono); cambio = true; }
    if (cambio) $app.save(u);
  } catch (err) {
    console.log('ficha a cuenta: ' + err);
  }
  e.next();
}
onRecordAfterCreateSuccess(fichaACuenta, 'fichas');
onRecordAfterUpdateSuccess(fichaACuenta, 'fichas');
