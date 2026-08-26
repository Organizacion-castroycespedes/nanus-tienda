# Risks: soportar cajon monedero via impresora XP-80 LAN

- El resolver puede seguir prefiriendo MOCK si no se encadena bien la terminal canonical.
- La impresora puede responder bien a print y seguir fallando en pulse por cableado o RJ11.
- La UI puede dejar al usuario configurar drawer y printer como dos cosas independientes.
- Un retry automatico mal puesto puede mandar mas de un pulso por request.
- Si el error model no queda claro, QA puede confundir `transport failure` con `device not found`.
