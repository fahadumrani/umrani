import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyChunk,
  cleanFinalResponse,
  collapseRepeatedResponse,
  trimRunawayRepetition,
  isProviderErrorContent,
  filterThinkingContent
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

test("detects Dahl capacity notices returned as successful text", () => {
  assert.equal(
    isProviderErrorContent(
      "This model is at concurrency capacity. Paid accounts are admitted first. " +
      "Top up at https://inference.dahl.global/account"
    ),
    true
  );
  assert.equal(isProviderErrorContent("Here is a normal helpful answer."), false);
});

test("removes complete and partial private thinking blocks", () => {
  assert.deepEqual(
    filterThinkingContent("<think>private reasoning</think>\nFinal answer"),
    { content: "Final answer", thinking: false, hadThinking: true }
  );
  assert.deepEqual(
    filterThinkingContent("<analysis>still reasoning"),
    { content: "", thinking: true, hadThinking: true }
  );
  assert.deepEqual(
    filterThinkingContent("<thi"),
    { content: "", thinking: true, hadThinking: true }
  );
  assert.deepEqual(
    filterThinkingContent("A normal answer"),
    { content: "A normal answer", thinking: false, hadThinking: false }
  );
});