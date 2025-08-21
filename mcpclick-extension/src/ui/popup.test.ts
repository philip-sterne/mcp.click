import { bus } from '../common/bus';

// Mock the DOM
document.body.innerHTML = `
  <div>
    <input type="checkbox" id="log-traces" />
    <input type="text" id="domain" />
    <button id="start"></button>
    <button id="stop"></button>
    <button id="prepare"></button>
    <button id="upload"></button>
    <button id="connect"></button>
  </div>
`;

// Mock the bus
jest.mock('../common/bus', () => ({
  bus: {
    emit: jest.fn(),
  },
}));

describe('popup', () => {
  it('should save the logTraces preference', () => {
    // Run the popup script
    require('./popup');

    const logTracesCheckbox = document.getElementById(
      'log-traces'
    ) as HTMLInputElement;

    // Simulate a click
    logTracesCheckbox.checked = true;
    logTracesCheckbox.dispatchEvent(new Event('change'));

    // Check that the preference was saved
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ logTraces: true });
  });
});
