// Initialize map
let map;
let lotsLayer;
let selectedLot = null;
let initialView = {
    center: [40.23305, -83.02365],
    zoom: 17
};

// Base map layers - Using Google Satellite tiles via third-party provider
const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    attribution: 'Google Satellite',
    maxZoom: 21,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});

const greyLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20
});

// Initialize the map
function initMap() {
    map = L.map('map', {
        center: initialView.center,
        zoom: initialView.zoom,
        layers: [satelliteLayer],
        zoomControl: false
    });

    // Add zoom control to bottom left
    L.control.zoom({
        position: 'bottomleft'
    }).addTo(map);

    // Add layer control
    const baseMaps = {
        "Satellite": satelliteLayer,
        "Grey": greyLayer
    };

    L.control.layers(baseMaps, null, {
        position: 'topleft'
    }).addTo(map);

    // Load GeoJSON data
    loadLotsData();
}

// Load and display lots
function loadLotsData() {
    fetch('lots.geojson')
        .then(response => response.json())
        .then(data => {
            lotsLayer = L.geoJSON(data, {
                style: getDefaultStyle,
                onEachFeature: onEachLot
            }).addTo(map);

            // Add labels for each lot
            data.features.forEach(feature => {
                if (feature.properties.lot_no) {
                    const center = getPolygonCenter(feature.geometry.coordinates[0][0]);
                    // Add star icon for spec home (lot 22)
                    const labelHtml = feature.properties.status === 'spec_home'
                        ? `${feature.properties.lot_no} <span style="color: #f39c12;">★</span>`
                        : feature.properties.lot_no;

                    L.marker(center, {
                        icon: L.divIcon({
                            className: 'lot-label',
                            html: labelHtml,
                            iconSize: null,
                            iconAnchor: [0, 0]
                        })
                    }).addTo(map);
                }
            });

            // Fit map to lots bounds
            map.fitBounds(lotsLayer.getBounds(), {
                padding: [50, 50]
            });

            // Update initial view after fitting and increase zoom by 1 level
            initialView.center = map.getCenter();
            initialView.zoom = map.getZoom() + 1;
            map.setZoom(initialView.zoom);

            // Hide loading spinner
            document.getElementById('loading').classList.add('hidden');
        })
        .catch(error => {
            console.error('Error loading lots data:', error);
            document.getElementById('loading').classList.add('hidden');
            alert('Error loading property data. Please refresh the page.');
        });
}

// Calculate polygon center
function getPolygonCenter(coordinates) {
    let lat = 0;
    let lng = 0;
    const n = coordinates.length;

    coordinates.forEach(coord => {
        lng += coord[0];
        lat += coord[1];
    });

    return [lat / n, lng / n];
}

// Status color mapping
const statusColors = {
    available: '#2ecc71',    // Green
    pending: '#f39c12',       // Yellow/Orange
    sold: '#e74c3c',          // Red
    spec_home: '#3498db'      // Blue
};

// Default style for lots
function getDefaultStyle(feature) {
    const status = feature.properties.status || 'available';
    return {
        fillColor: statusColors[status],
        weight: 2,
        opacity: 1,
        color: '#1a1a1a',
        fillOpacity: 0.3
    };
}

// Highlight style
function getHighlightStyle(feature) {
    const status = feature.properties.status || 'available';
    return {
        fillColor: statusColors[status],
        weight: 3,
        opacity: 1,
        color: '#1a1a1a',
        fillOpacity: 0.6
    };
}

// Selected style
function getSelectedStyle(feature) {
    const status = feature.properties.status || 'available';
    return {
        fillColor: statusColors[status],
        weight: 3,
        opacity: 1,
        color: '#1a1a1a',
        fillOpacity: 0.7
    };
}

// Add interactivity to each lot
function onEachLot(feature, layer) {
    // Hover effects
    layer.on('mouseover', function(e) {
        if (selectedLot !== layer) {
            layer.setStyle(getHighlightStyle(feature));
        }
        layer.bringToFront();
    });

    layer.on('mouseout', function(e) {
        if (selectedLot !== layer) {
            layer.setStyle(getDefaultStyle(feature));
        }
    });

    // Click event
    layer.on('click', function(e) {
        selectLot(layer, feature);
    });

    // Add cursor pointer
    layer.on('mouseover', function() {
        map._container.style.cursor = 'pointer';
    });

    layer.on('mouseout', function() {
        map._container.style.cursor = '';
    });
}

// Select a lot and show details
function selectLot(layer, feature) {
    // Reset previous selection
    if (selectedLot && selectedLot.feature) {
        selectedLot.setStyle(getDefaultStyle(selectedLot.feature));
    }

    // Set new selection
    selectedLot = layer;
    selectedLot.feature = feature;
    layer.setStyle(getSelectedStyle(feature));

    // Get lot bounds
    const bounds = layer.getBounds();
    const center = bounds.getCenter();

    // Fly to the lot with smooth animation
    map.flyTo(center, Math.max(map.getZoom(), 18), {
        duration: 1.2,
        easeLinearity: 0.25
    });

    // Show property details in drawer
    showPropertyDetails(feature.properties);
}

// Get status display name
function getStatusDisplayName(status) {
    const statusNames = {
        available: 'Available',
        pending: 'Pending',
        sold: 'Sold',
        spec_home: 'Spec Home'
    };
    return statusNames[status] || 'Available';
}

// Show property details in drawer
function showPropertyDetails(properties) {
    const drawer = document.getElementById('propertyDrawer');
    const lotNumber = document.getElementById('lotNumber');
    const acreage = document.getElementById('acreage');
    const dimensions = document.getElementById('dimensions');
    const status = document.getElementById('status');

    // Update content
    lotNumber.textContent = properties.lot_no || 'N/A';
    acreage.textContent = properties.acreage ? `${properties.acreage} acres` : 'N/A';
    dimensions.textContent = properties.dimensions || 'N/A';
    status.textContent = getStatusDisplayName(properties.status);

    // Show drawer with animation
    drawer.classList.add('active');
}

// Close drawer
function closePropertyDrawer() {
    const drawer = document.getElementById('propertyDrawer');
    drawer.classList.remove('active');

    // Reset selection
    if (selectedLot && selectedLot.feature) {
        selectedLot.setStyle(getDefaultStyle(selectedLot.feature));
        selectedLot = null;
    }
}

// Reset map view
function resetMapView() {
    closePropertyDrawer();

    // Animate back to initial view
    map.flyTo(initialView.center, initialView.zoom, {
        duration: 1.2,
        easeLinearity: 0.25
    });
}

// Event listeners
document.getElementById('closeDrawer').addEventListener('click', closePropertyDrawer);
document.getElementById('resetBtn').addEventListener('click', resetMapView);

// Close drawer when clicking outside
document.addEventListener('click', function(e) {
    const drawer = document.getElementById('propertyDrawer');
    const isDrawerClick = drawer.contains(e.target);
    const isMapClick = document.getElementById('map').contains(e.target);

    if (!isDrawerClick && !isMapClick && drawer.classList.contains('active')) {
        closePropertyDrawer();
    }
});

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', initMap);
