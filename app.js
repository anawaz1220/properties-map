// Initialize map
let map;
let lotsLayer;
let selectedLot = null;

// Detect mobile screen
const isMobile = window.innerWidth <= 768;

let initialView = {
    center: [40.23305, -83.02365],
    zoom: isMobile ? 16 : 18
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

  

    // Add layer control
    const baseMaps = {
        "Satellite": satelliteLayer,
        "Grey": greyLayer
    };

    L.control.layers(baseMaps, null, {
        position: 'topleft'
    }).addTo(map);

      // Add zoom control to bottom left
    L.control.zoom({
        position: 'topleft'
    }).addTo(map);

    // Load GeoJSON data
    loadLotsData();
}

// Store label markers for zoom-based visibility
let labelMarkers = [];

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

                    const marker = L.marker(center, {
                        icon: L.divIcon({
                            className: 'lot-label',
                            html: labelHtml,
                            iconSize: [50, 20],
                            iconAnchor: [25, 10]
                        }),
                        interactive: false  // Make labels non-interactive
                    }).addTo(map);

                    labelMarkers.push(marker);
                }
            });

            // Update label visibility based on zoom
            updateLabelVisibility();

            // Add zoom event listener
            map.on('zoomend', updateLabelVisibility);

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

// Update label visibility based on zoom level
function updateLabelVisibility() {
    const currentZoom = map.getZoom();
    const minZoomForLabels = 18; // Hide labels below this zoom level

    labelMarkers.forEach(marker => {
        if (currentZoom >= minZoomForLabels) {
            marker.setOpacity(1);
        } else {
            marker.setOpacity(0);
        }
    });

    // Close all tooltips when at zoom 18 or higher
    if (currentZoom >= minZoomForLabels && lotsLayer) {
        lotsLayer.eachLayer(function(layer) {
            if (layer.getTooltip()) {
                layer.closeTooltip();
            }
        });
    }
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

// Calculate polygon top position (northernmost point with slight offset inward)
function getPolygonTopPosition(coordinates) {
    // Find the northernmost (highest latitude) point
    let maxLat = -Infinity;
    let maxLatLng = 0;

    coordinates.forEach(coord => {
        if (coord[1] > maxLat) {
            maxLat = coord[1];
            maxLatLng = coord[0];
        }
    });

    // Get center for longitude reference
    const center = getPolygonCenter(coordinates);

    // Position slightly below the top edge (85% up from center to top)
    const offsetLat = center[0] + (maxLat - center[0]) * 0.85;

    return [offsetLat, center[1]];
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
    // Bind tooltip for hover display (shown when labels are hidden)
    const tooltipContent = feature.properties.status === 'spec_home'
        ? `${feature.properties.lot_no} ★`
        : feature.properties.lot_no;

    layer.bindTooltip(tooltipContent, {
        permanent: false,
        direction: 'top',
        className: 'lot-tooltip',
        opacity: 1,
        offset: [0, -10]
    });

    // Hover effects
    layer.on('mouseover', function(e) {
        if (selectedLot !== layer) {
            layer.setStyle(getHighlightStyle(feature));
        }
        layer.bringToFront();
        map._container.style.cursor = 'pointer';

        // Show tooltip only when labels are hidden (zoom < 18)
        const currentZoom = map.getZoom();
        if (currentZoom < 18) {
            layer.openTooltip();
        } else {
            layer.closeTooltip();
        }
    });

    layer.on('mouseout', function(e) {
        if (selectedLot !== layer) {
            layer.setStyle(getDefaultStyle(feature));
        }
        map._container.style.cursor = '';

        // Always close tooltip on mouseout
        layer.closeTooltip();
    });

    // Click event - ensure it captures clicks on the entire polygon
    layer.on('click', function() {
        // Close tooltip immediately on click
        layer.closeTooltip();
        selectLot(layer, feature);
    });

    // Also handle touchend for mobile devices
    layer.on('touchend', function(e) {
        L.DomEvent.preventDefault(e);
        // Close tooltip immediately on touch
        layer.closeTooltip();
        selectLot(layer, feature);
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
