import json
import random

# Word pools
names = ["Alice", "Bob", "Carol", "David", "Emma", "Frank", "Grace", "Henry", "Ivy", "Jack",
         "Kate", "Liam", "Mona", "Noah", "Olivia", "Paul", "Quinn", "Rose", "Sam", "Tina",
         "Uma", "Victor", "Wendy", "Xavier", "Yara", "Zane"]

verbs = ["runs", "jumps", "walks", "writes", "reads", "sings", "plays", "builds", "drives", "eats",
         "drinks", "opens", "closes", "finds", "carries", "throws", "catches", "climbs"]

objects = ["book", "chair", "table", "car", "house", "dog", "cat", "ball", "song", "story",
           "letter", "window", "flower", "tree", "door", "apple", "cake", "river"]

places = ["in the park", "at school", "on the street", "near the river", "in the room",
          "at the market", "on the hill", "under the tree", "at the station"]

adjectives = ["big", "small", "red", "blue", "happy", "sad", "fast", "slow", "quiet", "loud",
              "bright", "dark", "new", "old", "warm", "cold"]

def make_simple():
    return f"{random.choice(names)} {random.choice(verbs)} a {random.choice(objects)}."

def make_medium():
    return f"{random.choice(names)} {random.choice(verbs)} a {random.choice(adjectives)} {random.choice(objects)} {random.choice(places)}."

def make_hard():
    return f"Although {random.choice(names)} {random.choice(verbs)} a {random.choice(objects)}, {random.choice(names)} decided to {random.choice(verbs)} {random.choice(places)} because it was {random.choice(adjectives)}."

data = {
    "simple": [make_simple() for _ in range(150)],
    "medium": [make_medium() for _ in range(150)],
    "hard": [make_hard() for _ in range(100)]
}

with open("sentences.json", "w") as f:
    json.dump(data, f, indent=2)

print("✅ sentences.json created with", len(data["simple"]), "simple,", len(data["medium"]), "medium,", len(data["hard"]), "hard sentences.")
