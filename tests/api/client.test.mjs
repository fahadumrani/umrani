import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyChunk,
  cleanFinalResponse,
  collapseRepeatedResponse,
  trimRunawayRepetition
} from "../../src/api/client.js";

test("classifies cumulative and duplicate stream chunks", () => {
  const first = "Answer:\nOne item";
  assert.equal(classifyChunk("Answer:\nOne item\nTwo items", first), "cumulative");
  assert.equal(classifyChunk(first, first), "duplicate");
  assert.equal(classifyChunk(" plus another item", first), "fresh");
});

test("collapses an exact triple response", () => {
  const response = "This is a sufficiently long response for testing.";
  assert.equal(
    collapseRepeatedResponse(response + response + response),
    response
  );
});

test("leaves a normal response unchanged", () => {
  const response = "A normal answer with no repeated complete copy.";
  assert.equal(collapseRepeatedResponse(response), null);
  assert.equal(cleanFinalResponse(response), null);
  assert.equal(trimRunawayRepetition(response), null);
});

test("trims repeated sentence loops", () => {
  const sentence = "This sentence is being repeated.";
  const repeated = `${sentence} ${sentence} ${sentence} ${sentence}`;
  assert.equal(trimRunawayRepetition(repeated), `${sentence} `);
});