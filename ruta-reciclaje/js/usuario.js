document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar mapa
  const mapa = cargarMapaBase('mapa-usuario');
  const listaSectores = document.getElementById('lista-sectores');
  let capaSectores = null;

  // Ajustar posición del mapa para que no interfiera con el navbar
  const navbarHeight = document.querySelector('.navbar').offsetHeight;
  document.getElementById('mapa-usuario').style.marginTop = `${navbarHeight}px`;
  mapa.invalidateSize();

  // Cargar y dibujar sectores
  const geojsonData = await cargarDatosSectores();
  if (!geojsonData) return;
  
  // Función para actualizar contadores
  function actualizarContadores() {
    const conteo = {
      pendiente: 0,
      en_camino: 0,
      recolectado: 0
    };

    capaSectores.eachLayer(layer => {
      if (layer.feature) {
        const estado = layer.feature.properties.estado;
        if (conteo.hasOwnProperty(estado)) {
          conteo[estado]++;
        }
      }
    });

    document.getElementById('contador-pendientes').textContent = conteo.pendiente;
    document.getElementById('contador-camino').textContent = conteo.en_camino;
    document.getElementById('contador-recolectados').textContent = conteo.recolectado;

    // Actualizar barras de progreso
    const total = conteo.pendiente + conteo.en_camino + conteo.recolectado;
    if (total > 0) {
      document.getElementById('progress-pendiente').style.width = `${(conteo.pendiente / total) * 100}%`;
      document.getElementById('progress-camino').style.width = `${(conteo.en_camino / total) * 100}%`;
      document.getElementById('progress-completado').style.width = `${(conteo.recolectado / total) * 100}%`;
    }
  }

  // Dibujar sectores iniciales
  capaSectores = L.geoJSON(geojsonData, {
    style: (feature) => ({
      color: obtenerColorPorEstado(feature.properties.estado),
      weight: 2,
      fillOpacity: 0.5
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`
        <b>${feature.properties.nombre}</b>
        <div class="estado-${feature.properties.estado}">
          Estado: ${feature.properties.estado.replace('_', ' ').toUpperCase()}
        </div>
      `);
    }
  }).addTo(mapa);

  // Actualizar lista de sectores y contadores
  actualizarListaSectores(geojsonData);
  actualizarContadores();

  // Escuchar cambios en tiempo real
  db.collection('sectores').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'modified') {
        const sectorId = change.doc.id;
        const nuevoEstado = change.doc.data().estado;
        
        // Actualizar mapa
        capaSectores.eachLayer((layer) => {
          if (layer.feature?.properties?.id === sectorId) {
            layer.setStyle({
              color: obtenerColorPorEstado(nuevoEstado),
              fillColor: obtenerColorPorEstado(nuevoEstado)
            });
            layer.setPopupContent(`
              <b>${layer.feature.properties.nombre}</b>
              <div class="estado-${nuevoEstado}">
                Estado: ${nuevoEstado.replace('_', ' ').toUpperCase()}
              </div>
            `);
          }
        });
        
        // Actualizar lista con el color correcto
        const item = document.querySelector(`#lista-sectores li[data-id="${sectorId}"]`);
        if (item) {
          const badge = item.querySelector('.badge');
          badge.className = `badge ${obtenerClaseBadgePorEstado(nuevoEstado)}`;
          badge.textContent = nuevoEstado.replace('_', ' ');
        }
      }
    });
    actualizarContadores();
  });

  // Función para actualizar lista
  function actualizarListaSectores(geojsonData) {
    listaSectores.innerHTML = '';
    
    geojsonData.features.forEach(sector => {
      const item = document.createElement('li');
      item.className = 'list-group-item d-flex justify-content-between align-items-center';
      item.dataset.id = sector.properties.id;
      
      item.innerHTML = `
        ${sector.properties.nombre}
        <span class="badge ${obtenerClaseBadgePorEstado(sector.properties.estado)}">
          ${sector.properties.estado.replace('_', ' ')}
        </span>
      `;
      listaSectores.appendChild(item);
    });
  }

  // Función auxiliar para obtener clase de badge según estado
  function obtenerClaseBadgePorEstado(estado) {
    switch(estado) {
      case 'recolectado': return 'bg-success';
      case 'en_camino': return 'bg-warning';
      default: return 'bg-danger';
    }
  }
});