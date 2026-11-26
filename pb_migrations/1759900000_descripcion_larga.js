/// <reference path="../pb_data/types.d.ts" />

/* Descripción de la oportunidad hasta 3000 caracteres (pedido del
   cliente, 24-nov). El formulario cortaba en 600 y la base en 1500: el
   texto de su primera oportunidad quedó cortado justo en 600. */

migrate(function (app) {
  var op = app.findCollectionByNameOrId('oportunidades');
  op.fields.getByName('descripcion').max = 3000;
  app.save(op);
}, function (app) {
  var op = app.findCollectionByNameOrId('oportunidades');
  op.fields.getByName('descripcion').max = 1500;
  app.save(op);
});
