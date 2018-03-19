const program = require('commander');
const octokit = require('@octokit/rest')();
const pino = require('pino')();
const updater = require('./lib/updater');
const github = require('./lib/github');
const meetup = require('./lib/meetup');
const eventbrite = require('./lib/eventbrite');
const rss = require('./lib/rss');

// Create program.
program
  .version('1.0.0')
  .option('-c, --config [config]', 'Config file', './config.json')
  .parse(process.argv);

// Bail if no config file.
if (!program.config) {
  pino.error('Missing config path');
  process.exit(1);
}

// Load configuration.
const config = require(program.config);

// Authenticate against GitHub api.
octokit.authenticate(config.github.authentication);

(async () => {
  let events = await github(octokit, config.github);

  if (!(events instanceof Array)) {
    events = [];
  }

  const eventsMeetup = await meetup(config.meetup);
  if (eventsMeetup instanceof Array) {
    events = events.concat(eventsMeetup);
  }

  const eventsEventbrite = await eventbrite(config.eventbrite);
  if (eventsEventbrite instanceof Array) {
    events = events.concat(eventsEventbrite);
  }

  // Sort events by date.
  events = events.sort((a, b) => {
    return a.date - b.date;
  });

  // Remove undefined events.
  events = events.filter(event => {
    return typeof event === 'object';
  });

  // Limit events description length to 280.
  events = events.map(event => {
    let description = (event.description || '').substring(0, 280);

    if ((event.description || '').length > 280) {
      description += '...';
    }

    event.description = description.trim();

    return event;
  });

  // Update events file.
  updater(octokit, config.github, config.github.files.events, events);

  // Update rss file.
  updater(octokit, config.github, config.github.files.rss, rss(events));
})();
