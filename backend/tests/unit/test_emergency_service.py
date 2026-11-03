from src.modules.emergency.service import list_useful_numbers


def test_list_useful_numbers():
    numbers = list_useful_numbers()

    assert len(numbers) == 5

    phones = {number["phone"] for number in numbers}

    assert phones == {"180", "190", "192", "193", "100"}

    for number in numbers:
        assert number["name"]
        assert number["phone"]
        assert number["description"]