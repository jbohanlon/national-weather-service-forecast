window.addEventListener("DOMContentLoaded", () => {
	document.getElementById("weather-form").addEventListener("submit", (e) => {
		e.preventDefault();
		getWeather();
	});
});

async function getWeather() {
	const city =
		document.getElementById("city-input").value === ""
			? "New York"
			: document.getElementById("city-input").value;

	const [lat, lon] = await getCurrentConditions(city, Config.apiKey);
	console.log(lat, lon);

	// Don't try to get a forecast if you encountered error lat lon values
	if (lat !== undefined && lon !== undefined) {
		hideSearchError();
		getForecast(lat, lon, Config.apiKey);
	} else {
		showSearchError(`Couldn't find ${escapeHtml(city)}`);
	}
}

// Replaces dangerous characters with equivalent HTML entities for safe display in HTML
function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function hideSearchError() {
	document.getElementById("search-error").classList.add("d-none");
}

function showSearchError(errorMessage) {
	const searchErrorElement = document.getElementById("search-error");

	searchErrorElement.innerHTML = errorMessage;
	searchErrorElement.classList.remove("d-none");
}

// Fetch current weather conditions and add corresponding HTML elements to the page.
// Returns latitude and longitude associated with a location to avoid an additional
// geolocation lookup request.
async function getCurrentConditions(city, apiKey) {
	const currentWeather = await fetch(
		`https:\\api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
			city
		)}&appid=${apiKey}`
	);

	if (currentWeather.status !== 200) {
		console.log("Error: " + currentWeather.status);
		document
			.getElementById("searched-city-current-conditions")
			.insertAdjacentHTML("beforeend", "<p>Invalid city</p>");
		return [undefined, undefined];
	}

	console.log(currentWeather);

	const currentWeatherData = await currentWeather.json();
	console.log(currentWeatherData);

	writeCurrentConditions(
		document.getElementById("searched-city-current-conditions"),
		currentWeatherData
	);

	// TODO: Write addMap() and call it like this:
	// addMap(targetDiv, currentWeatherData.coord.lat, currentWeatherData.coord.lon);

	return [currentWeatherData.coord.lat, currentWeatherData.coord.lon];
}

// Write current conditions to HTML
function writeCurrentConditions(targetDiv, data) {
	// Clear targetDiv's contents to avoid stacking weather data output
	targetDiv.innerHTML = "";

	// Add a new div that holds the requested location's current weather data
	const currentWeatherDiv = document.createElement("div");
	currentWeatherDiv.setAttribute("class", "current-weather-container");

	// Add a relevant image
	currentWeatherDiv.insertAdjacentHTML(
		"beforeend",
		getWeatherImage(data.weather[0].icon, data.weather[0].main)
	);

	// Add corresponding text data
	currentWeatherDiv.insertAdjacentHTML(
		"beforeend",
		`<p class="text-center w-100">Right now in ${data.name}, ${
			data.sys.country
		} it's ${kelvinToFahrenheitRounded(data.main.temp)}&deg;F</p>`
	);

	// Put all of your additions into the div
	targetDiv.appendChild(currentWeatherDiv);
}

// Convert Kelvin temperatures from OpenWeatherMap to rounded Fahrenheit
function kelvinToFahrenheitRounded(temp) {
	return Math.round((temp - 273.15) * 1.8 + 32);
}

// Return an image corresponding to given weather conditions
function getWeatherImage(icon, description) {
	// TODO: Replace OWM images with better ones
	// Weather images from OWM: https://openweathermap.org/weather-conditions#Icon-list

	const imageUrlBeginning = "https://openweathermap.org/img/wn/";
	const imageUrlEnd = "@4x.png";

	return `<img class="current-weather-image" src="${
		imageUrlBeginning + icon + imageUrlEnd
	}" alt="${description}"/>`;
}

// Return 5-day forecast data for given latitude and longitude coordinates.
// Also includes weather alerts for the given area if applicable.
async function getForecast(lat, lon, apiKey) {
	const forecast = await fetch(
		`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&appid=${apiKey}`
	);

	console.log(forecast);

	const forecastData = await forecast.json();
	console.log(forecastData);

	writeForecast(
		document.getElementById("searched-city-forecast"),
		forecastData
	);
}

// Write forecast to HTML
function writeForecast(targetDiv, data) {
	// Clear targetDiv's contents to avoid stacking weather forecast output
	targetDiv.innerHTML = "";

	// Add a new div that holds the requested location's forecast data
	const forecastDiv = document.createElement("div");
	forecastDiv.setAttribute("class", "forecast-container");

	// Create a list to hold each day's forecast data and corresponding images
	const forecastList = document.createElement("ul");
	forecastDiv.appendChild(forecastList);

	// Add a li for each day of forecast data
	for (
		let forecastIndex = 0;
		forecastIndex < data.daily.length;
		forecastIndex++
	) {
		let day = document.createElement("li");

		day.setAttribute("class", "forecast-day");

		day.innerHTML = `${getWeatherImage(
			data.daily[forecastIndex].weather[0].icon,
			capitalizeFirstLetter(data.daily[forecastIndex].weather[0].description)
		)}<p class="forecast-line text-center">${secondsToDayString(
			data.daily[forecastIndex].dt,
			forecastIndex
		)}: ${capitalizeFirstLetter(
			data.daily[forecastIndex].weather[0].description
		)}, with a high of ${kelvinToFahrenheitRounded(
			data.daily[forecastIndex].temp.max
		)} and a low of ${kelvinToFahrenheitRounded(
			data.daily[forecastIndex].temp.min
		)}</p>`;

		forecastList.appendChild(day);
	}

	// Write the forecast HTML to the page
	forecastDiv.appendChild(forecastList);
	targetDiv.appendChild(forecastDiv);
}

// Returns a day string based on a given date in seconds.
// Takes forecast array index as an argument to handle time zone-related formatting issues.
function secondsToDayString(dateInSeconds, index) {
	let date = new Date(dateInSeconds * 1000);
	let today = new Date();

	if (index == 0) {
		// Formatting fix to account for time zones
		if (today.getHours() > 18 || today.getHours() < 4) {
			return "Overnight";
		} else {
			return "Today";
		}
	} else if (index == 1) {
		return "Tomorrow";
	}

	return date.toLocaleDateString("en-US", { weekday: "long" });
}

// Return a string with the first letter capitalized
function capitalizeFirstLetter(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// TODO: Maybe add a map using a request like this: https://openweathermap.org/api/weathermaps

// TODO: See if you can get historical data through the NWS API

function getWeatherBackground(weather) {
	// TODO: Use some free images from Flickr (check usage rights!) to get cool weather-related backgrounds
	// Flickr API: https://www.flickr.com/services/api/
}
