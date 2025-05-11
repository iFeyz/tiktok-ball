declare module 'midi-parser-js' {
  /**
   * Parse MIDI data from a buffer
   * @param buffer ArrayBuffer containing MIDI data
   * @returns Parsed MIDI data object
   */
  export function parse(buffer: ArrayBuffer): any;
  
  /**
   * The main MidiParser object with utility functions
   */
  const MidiParser: {
    /**
     * Parse MIDI data from a buffer
     * @param buffer ArrayBuffer containing MIDI data
     * @returns Parsed MIDI data object
     */
    parse: (buffer: ArrayBuffer) => any;
  };
  
  export default MidiParser;
} 