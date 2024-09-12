
function getYear(meteorite) {
    const date = new Date(meteorite.year);
    return date.getFullYear();
}

function getMass(meteorite) {
    return Math.floor(Number(meteorite.mass));
}

function equalFreqBin(data, colors) {
    const sortedData = data.map(d => getMass(d)).sort((a, b) => a - b);
    const bins = [];
    for (let i = 0; i < colors.length - 1; ++i) {
        let cutoff = (i + 1) * Math.floor(sortedData.length / colors.length);
        bins.push([colors[i], sortedData[cutoff]]);
    }
    bins.push([colors[colors.length - 1], sortedData[sortedData.length - 1]]);
    return bins;
}

function filterMeteorites(yearStart, yearEnd, data) {
    function includeMeteorite(meteorite) {
        const year = getYear(meteorite);
        return (yearStart <= year) && (year <= yearEnd);
    }

    return data.filter(includeMeteorite);
}

function legend(map, title, bins) {
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML += `<h4>${title}</h4>`
        // loop through our intervals and generate a label with a colored square for each interval
        for (let i = 0; i < bins.length; i++) {
            div.innerHTML +=
                '<i style="background:' + bins[i][0] + '"></i> \u2264 ' + bins[i][1] + '<br>';
        }
        return div;
    };
    legend.addTo(map);
}

function timeRangeSlider(meteoriteLayer, id, data, bins) {
    // Read data into a crossfilter
    const chart = dc.barChart(id);
    const ndx = crossfilter(data);
    const yearDim = ndx.dimension((elem) => getYear(elem));
    const minYear = 1800;
    const maxYear = getYear(yearDim.top(1)[0]);
    const countPerYear = yearDim.group().reduceCount();
    const maxCount = countPerYear.top(1)[0].value;
    let meteorites;

    // Populate chart data
    chart
        .height(window.innerHeight * 0.20)
        .dimension(yearDim)
        .group(countPerYear)
        .x(d3.scaleLinear().domain([minYear, maxYear]))
        .round(Math.round)
        .xAxisLabel("Year")
        .elasticY(true)
        .y(d3.scaleSqrt().domain([0, Math.sqrt(maxCount)]).nice())
        .yAxisLabel("Meteorites")  // Add a label for the y-axis
        .renderHorizontalGridLines(true)  // Optionally add grid lines
        .colors('black') 
        .on('renderlet', () => {
            const filter = chart.filter();
            if (filter) {
                meteorites = filterMeteorites(filter[0], filter[1], data);
                d3.select(id).select(".yearStart").html(filter[0]);
                d3.select(id).select(".yearEnd").html(filter[1]);
            }
            else {
                meteorites = filterMeteorites(minYear, maxYear, data);
                d3.select(id).select(".yearStart").html(minYear);
                d3.select(id).select(".yearEnd").html(maxYear);
            }
            console.log(meteorites);
            renderMeteorites(meteorites, meteoriteLayer, bins);
        });

    // Format x and y ticks
    chart.xAxis().tickFormat(function (d) { return d }); // convert back to base unit
    chart.yAxis().tickFormat(d3.format(".2~s"));
    chart.yAxis().ticks(5);

    dc.registerChart(chart, id);
    dc.renderAll();

    var doit;
    window.addEventListener("resize", () => {
        clearTimeout(doit);
        doit = setTimeout(() => { dc.renderAll() }, 200)
    });
}

function renderMeteorites(data, meteoriteLayer, bins) {
    console.log("rendering");
    meteoriteLayer.clearLayers();
    data.forEach((d) => {
        let lat = isNaN(d.reclat) ? 0 : d.reclat;
        let long = isNaN(d.reclong) ? 0 : d.reclong;
        
        let color;
        for (let i = 0; i < bins.length; ++i) {
            color = bins[i][0];
            if (getMass(d) <= bins[i][1]) {
                break;
            }
        }
        
        
        const marker = L.circleMarker([lat, long], {
            // color: color,
            fillColor: color,
            fillOpacity: 0.75,
            weight: 0,
            radius: 5
        });
        marker.bindPopup(`<b>Location:</b> ${d.name}<br><b>Mass:</b> ${d.mass} (g)<br><b>Year:</b> ${getYear(d)}`);
        marker.addTo(meteoriteLayer);
    });
}

// Initialize the map
const map = L.map("map", {
    preferCanvas: true
}).setView([0, 0], 1);
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://carto.com/">Carto</a>',
    maxZoom: 19,
    updateWhenIdle: true,
    updateWhenZooming: false
}).addTo(map);

// Create a layer for the meteorites
const meteoriteLayer = L.layerGroup();
meteoriteLayer.addTo(map);

// Grab the data
const LIMIT = 10000;
fetch(`https://data.nasa.gov/resource/gh4g-9sfh.json?$limit=${LIMIT}`)
    .then((response) => response.json())
    .then((data) => {
        // Fisher-Yates Shuffle Algorithm
        function shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]]; // Swap elements
            }
            return array;
        }

        const sample = shuffle(data).slice(0, LIMIT);

        // Filter out invalid year and mass values
        const validData = sample.filter((elem) => {
            const date = new Date(elem.year);
            return !isNaN(date.getTime()) && !isNaN(Number(elem.mass));
        });

        // get color ranges
        const colors = [
            "#ffcb05",
            "#d0a200",
            "#a27c00",
            "#785700",
            "#523300",
            "#380900"
        ]
        const bins = equalFreqBin(validData, colors);
        
        legend(map, "Mass (g)", bins);

        timeRangeSlider(meteoriteLayer, "#year_range", validData, bins);
    })
    .catch((err) => console.log(err));
