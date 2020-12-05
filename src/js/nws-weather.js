async function generateForecast() {
	// Grand Central Terminal in New York, NY example is the default for testing
	const lat = parseFloat(
		document.getElementById("lat-input").value === ""
			? 40.7527
			: document.getElementById("lat-input").value
	);
	const lon = parseFloat(
		document.getElementById("lon-input").value === ""
			? -73.9772
			: document.getElementById("lon-input").value
	);

	const weatherDiv = document.getElementById("weather-data");
	const forecastData = await getForecastData(lat, lon);
	console.log(forecastData);

	writeCurrentWeather(weatherDiv, forecastData.forecastHourlyData);
	writeForecast(weatherDiv, forecastData.forecastDayNightData);
}

// Takes a latitude/longitude pair and returns an object containing
// forecast data for the current week by day/night and by hour
async function getForecastData(lat, lon) {
	const coordinateRequest = await fetch(
		`https://api.weather.gov/points/${lat},${lon}`
	);
	const coordinateData = await coordinateRequest.json();

	const forecastUrl = coordinateData.properties.forecast;
	const forecastHourlyUrl = coordinateData.properties.forecastHourly;

	const responses = await Promise.all([
		fetch(forecastUrl),
		fetch(forecastHourlyUrl),
	]);

	const forecastDataValues = await Promise.all([
		responses[0].json(),
		responses[1].json(),
	]);

	return {
		forecastDayNightData: forecastDataValues[0],
		forecastHourlyData: forecastDataValues[1],
	};
}

function writeCurrentWeather(weatherDiv, weatherData) {
	weatherDiv.insertAdjacentHTML(
		"beforeend",
		"Right now it's " +
			weatherData.properties.periods[0].temperature +
			"º" +
			weatherData.properties.periods[0].temperatureUnit +
			" and " +
			weatherData.properties.periods[0].shortForecast.toLowerCase()
	);
}

function writeForecast(weatherDiv, weatherData) {
	// Create a div to hold the weekly forecast
	const weeklyForecast = document.createElement("div");
	weeklyForecast.setAttribute("id", "forecast-container");

	// Create a list within the weekly forecast div
	const forecastList = document.createElement("ul");
	forecastList.setAttribute("id", "forecast-list");
	weeklyForecast.appendChild(forecastList);

	for (const timePeriod of weatherData.properties.periods) {
		forecastList.insertAdjacentHTML(
			"beforeend",
			`<div id=${timePeriod.name}>` +
				"<img src=" +
				timePeriod.icon +
				"><br />" +
				`<strong>${timePeriod.name}</strong>` +
				"<br />" +
				timePeriod.detailedForecast +
				"<br /><br />" +
				"</div>"
		);
	}
	weatherDiv.appendChild(weeklyForecast);
}
